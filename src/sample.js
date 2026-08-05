function add(a, b) {
    return a + b;
}

function multiply(a, b) {
    return a * b;
}

const subtract = (a, b) => {
    return a - b;
};

class UserService {
    login(email, password) {
        return true;
    }

    logout() {
        return true;
    }
}

function validateUser(user) {
    return user !== null;
}

function loginUser(user) {
    if (!validateUser(user)) {
        throw new Error("Invalid User");
    }

    return true;
}