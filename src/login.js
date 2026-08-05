const { validateUser } = require("./auth");

function loginUser(user) {
    if (!validateUser(user)) {
        throw new Error("Invalid User");
    }

    return true;
}

module.exports = { loginUser };