const express = require("express");
const app = express();
const mongoose = require('mongoose');
const path = require("path");
const Users = require("./signup.js");
const multer = require('multer');
const Postings = require("./jobPostings.js");
const jobApplications = require("./jobApplications.js");

app.use('/resumes', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/user19')
    .then(() => { console.log("MongoDB connected"); });

let port = 8080;

app.use((req, res, next) => {
    res.locals.isLoggedIn = false;
    res.locals.user = null;
    next();
});

app.get("/", (req, res) => {
    res.redirect("/signup");
})

app.get("/signup", (req, res) => {
    res.render("signUp.ejs", { isLoggedIn: false });
})

app.post("/signup", async (req, res) => {
    let email = req.body.email;
    let alreadyExist = false;
    const findUser = await Users.findOne({ email: email });
    if (!findUser) {
        let userListing = new Users({
            fullName: req.body.fullName,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role,
        });
        await userListing.save();
    } else {
        alreadyExist = true;
    }
    res.render("signUpDone.ejs", { alreadyExist, isLoggedIn: false });
})

app.get("/login", (req, res) => {
    res.render("login.ejs", { isLoggedIn: false });
})

app.post("/checkLogin", async (req, res) => {
    const { email, password } = req.body;
    const findUser = await Users.findOne({ email: email, password: password });
    if (!findUser) {
        return res.render("WrongLogin.ejs", { isLoggedIn: false });
    }

    const isLoggedIn = true;

    if (findUser.role == "jobseeker") {
        const userApplications = await jobApplications.find({ applicantId: findUser._id });
        const jobPostings = await Postings.find();
        res.render("JobSeeker.ejs", {
            userApplications,
            id: findUser._id,
            email,
            fullName: findUser.fullName,
            role: findUser.role,
            jobs: jobPostings,
            isLoggedIn,
            user: findUser
        });
    } else {
        const jobPostings = await Postings.find({ postedBy: findUser._id });
        res.render("JobPoster.ejs", {
            id: findUser._id,
            email,
            fullName: findUser.fullName,
            role: findUser.role,
            jobs: jobPostings,
            isLoggedIn,
            user: findUser
        });
    }
})

app.get("/logout", (req, res) => {
    res.render("signUp.ejs", { isLoggedIn: false });
})

app.get("/jobPostings/:id", async (req, res) => {
    try {
        let id = req.params.id;
        const user = await Users.findById(id);
        const jobPostings = await Postings.find();
        const userApplications = await jobApplications.find({ applicantId: id });

        res.render("JobSeeker.ejs", {
            fullName: user.fullName,
            jobs: jobPostings,
            id,
            userApplications,
            isLoggedIn: true,
            user
        });
    } catch (error) {
        res.status(500).send("Server error");
    }
});

app.get('/backJobPosting/:id', async (req, res) => {
    let id = req.params.id;
    const user = await Users.findById(id);
    const jobs = await Postings.find({ postedBy: id });
    res.render("JobPoster.ejs", { id, fullName: user.fullName, jobs, isLoggedIn: true, user });
});

app.post("/applyJob/:id", upload.single('resume'), async (req, res) => {
    try {
        const { jobId, fullName, email, phone, coverLetter } = req.body;
        const resume = req.file;
        let id = req.params.id;

        const newApplication = new jobApplications({
            jobId: jobId,
            applicantId: id,
            fullName,
            email,
            phone,
            coverLetter,
            resumeFileName: resume ? resume.filename : null
        });
        await newApplication.save();

        const user = await Users.findById(id);
        if (!user) {
            return res.status(400).send("User not found.");
        }

        const job = await Postings.findById(jobId);
        if (!job) {
            return res.status(400).send("Job not found.");
        }
        res.render("JobSeekerSubmit.ejs", {
            id: id,
            email: email,
            fullName: fullName,
            role: user.role,
            jobs: [job],
            phone,
            coverLetter,
            resumeFileName: resume ? resume.filename : null,
            isLoggedIn: true,
            user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error.");
    }
});

app.post("/jobApplicationUser/:jobId/:userId", async (req, res) => {
    try {
        const { jobId, userId } = req.params;

        const applications = await jobApplications.find({ jobId: jobId });
        const job = await Postings.findById(jobId);
        const user = await Users.findById(userId);

        if (!job || !user) {
            return res.status(404).send("Job or User not found");
        }

        res.render("jobApplicationView.ejs", {
            applications,
            job,
            user,
            posterId: job.postedBy,
            isLoggedIn: true
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/updateStatus/:appId/:jobId", async (req, res) => {
    try {
        const { appId, jobId } = req.params;
        const { status } = req.body;
        await jobApplications.findByIdAndUpdate(appId, { status });
        const applications = await jobApplications.find({ jobId: jobId });
        const job = await Postings.findById(jobId);
        const updatedApp = await jobApplications.findById(appId);
        const user = await Users.findById(updatedApp.applicantId);

        res.render("jobApplicationView.ejs", {
            job,
            user,
            applications,
            posterId: job.postedBy,
            isLoggedIn: true
        });
    } catch (err) {
        console.error("Error updating status:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/postJob/:id", async (req, res) => {
    let id = req.params.id;
    const skillsArray = req.body.skills
        ? req.body.skills.split(',').map(skill => skill.trim()).filter(skill => skill.length > 0)
        : [];
    const findUser = await Users.findById(id);
    const { title, company, location, type, description, applicationDeadline, salary } = req.body;
    try {
        const newJob = new Postings({
            title,
            company,
            location,
            description,
            type,
            salary,
            skills: skillsArray,
            applicationDeadline,
            postedBy: id,
        });
        await newJob.save();
        const jobPostings = await Postings.find({ postedBy: id });
        res.render("jobPostSubmit.ejs", { id, fullName: findUser.fullName, jobs: jobPostings, isLoggedIn: true, user: findUser });
    } catch (error) {
        console.error("Error posting job:", error);
        res.status(500).send("Something went wrong while posting the job.");
    }
})

app.get("/postJob/:id", (req, res) => {
    let id = req.params.id;
    res.render("addJobPost.ejs", { id, isLoggedIn: true });
})

app.get("/apply/:jobId/:id", (req, res) => {
    let jobId = req.params.jobId;
    let userId = req.params.id;
    res.render("applyDetails.ejs", { jobId, userId, isLoggedIn: true });
})

app.listen(port, () => {
    console.log(`App is listening at port : ${port}`);
});