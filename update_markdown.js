const yaml = require("yaml");
const fs = require(`fs-extra`);
const path = require("path");
const { v4: uuidv4 } = require("uuid");

let cardConfigs = yaml.parse(
    fs.readFileSync("cards.yaml", "utf8")
);

for (let cardFilename in cardConfigs) {
    let markdownFile = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
    let arr = markdownFile.split(/\r?\n/);
    var existingTag
    arr.forEach((line, idx) => {
        if (line.includes("Guru tag - ")) {
            var line_arr = line.split(" ")
            existingTag = line_arr[line_arr.length - 1]
            return true
        } else {
            return false
        }
    });


    if (!existingTag) {
        let uniqueTagValue = uuidv4()
        let uniqueTagValueToWrite = `\nGuru tag - ${uniqueTagValue}`;

        fs.appendFileSync(path.resolve(`${cardFilename}`), uniqueTagValueToWrite, { flag: "as" })
    }
}
