const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    fullName: String,
    password: String,
    role: String,
    email: String,
});

const Users = mongoose.model("Users", userSchema);

module.exports = Users;