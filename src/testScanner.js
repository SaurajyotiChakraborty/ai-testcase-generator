const {
    scanFolder
} = require("./fileScanner");

const files =
    scanFolder("./src");

console.log(files);