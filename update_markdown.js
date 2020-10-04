const yaml = require("yaml");
const fs = require(`fs-extra`);
const path = require("path");
const { v4: uuidv4 } = require("uuid");

let cardConfigs = yaml.parse(
    fs.readFileSync("cards.yaml", "utf8")
);

for (let cardFilename in cardConfigs) {
    //TODO - add some conditional logic to only set unique tag value if no `tagValue`
    let file = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
    let arr = file.split(/\r?\n/);
    var existingTag
    let existingUniqueTag = arr.forEach((line, idx) => {
        if (line.includes("Guru tag - ")) {
            var line_arr = line.split(" ")
            console.log("line arr", line_arr)
            existingTag = line_arr[line_arr.length - 1]
            return True
        } else {
            return False
        }
    });
    console.log("existingUniqueTag", existingTag)




    let uniqueTagValue
    let content
    if (!existingTag) {
        console.log("No existing unique tag value... generating")
        uniqueTagValue = uuidv4()
        let uniqueTagValueToWrite = `\nGuru tag - ${uniqueTagValue}`;

        console.log("unique tag value to write", uniqueTagValueToWrite);

        fs.appendFileSync(path.resolve(`${cardFilename}`), uniqueTagValueToWrite, { flag: "as" })
        file = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
        console.log('The "data to append" was appended to file!', file);
        content = file

    } else {
        console.log(`Unique tag value found: ${uniqueTagValue}`)
        uniqueTagValue = existingTag
        content = file
    }

    console.log("CONTENT", content)
}


