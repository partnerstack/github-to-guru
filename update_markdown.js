const yaml = require("yaml");
const fs = require(`fs-extra`);
const path = require("path");
const { v4: uuidv4 } = require("uuid");

let cardConfigs = yaml.parse(
    fs.readFileSync("cards.yaml", "utf8")
);

for (let cardFilename in cardConfigs) {
    console.log("UPDATING MARKDOWN FILE WITH GURU TAG")
    let markdownFile = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
    let arr = markdownFile.split(/\r?\n/);
    let h2_regex = /^## \w+/
    var linesThatNeedH2Tags = []
    var existingH2TagLines = []
    var existingTag
    // idx - zero-indexed file line number
    // line - content of a given file line number (aka idx)
    arr.forEach((line, idx) => {
        if (line.includes("UUID Guru Tag -**")) {
            var line_arr = line.split(" ")
            existingTag = line_arr[line_arr.length - 1]
            return true
        } else if (
            line.includes("`") && line.includes("##") |
            line.includes(">") && line.includes("##") |
            line.includes("<") && line.includes("##")
        ) {
            console.log("We'll have to figure out how to handle this situation...")
            return true
        } else if (line.includes("`") | line.includes(">") | line.includes("<")) {
            console.log("We'll have to figure out how to handle this situation...")
            return true
        } if (line.indexOf("[**UUID H2 Guru Tag -** ") == 0) {
            console.log("This line is an existing H2 Tag...")
            existingH2TagLines.push(idx)
            console.log("Exising H2 Tag Lines", existingH2TagLines)
            return true
            // } if (line.indexOf("## ") == 0) {
        } if (h2_regex.test(line)) {
            // TODO - fix this so it doesn't include H3s
            console.log("This line needs an H2 Tag...", idx + 1)
            linesThatNeedH2Tags.push(idx + 1)
            return true
        } else {
            return false
        }
    });

    if (linesThatNeedH2Tags.length !== 0) {
        console.log("These lines will have new H2 tags...", linesThatNeedH2Tags)
        for (let i = 0; i < linesThatNeedH2Tags.length; i++) {
            if (!existingH2TagLines.includes(linesThatNeedH2Tags[i])) {
                console.log(`Generating H2 Tag for line ${linesThatNeedH2Tags[i]} `)
                let uniqueH2TagValue = uuidv4()
                let uniqueH2TagValueToWrite = `[**UUID H2 Guru Tag -** ${uniqueH2TagValue}]`

                arr.splice(linesThatNeedH2Tags[i] + i, 0, uniqueH2TagValueToWrite); // insert new tag into file lines array
            }
        }
        let newFileData = arr.join("\n"); // create the new file
        let file = fs.writeFileSync(path.resolve(`${cardFilename}`), newFileData, { encoding: "utf8" }); // save it
        console.log(`Added new unique tags to H2s`);
    }


    if (!existingTag) {
        console.log("No existing tag... creating one now")
        let uniqueTagValue = uuidv4()
        let uniqueTagValueToWrite = `\n***\n**UUID Guru Tag -** ${uniqueTagValue}`;

        let stream = fs.createWriteStream(path.resolve(`${cardFilename}`), { flags: 'as' })
        stream.write(`${uniqueTagValueToWrite}`)
        stream.end();
    }
}
