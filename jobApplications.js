const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Postings',
        required: true
    },
    applicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    fullName: String,
    email: String,
    phone: String,
    coverLetter: String,
    resumeFileName: String,
    appliedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ["Pending", "Accepted", "Rejected"],
        default: "Pending"
    }

});

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
