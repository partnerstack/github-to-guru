const yaml = require("yaml");
const fs = require(`fs-extra`);
const path = require("path");
const { v4: uuidv4 } = require("uuid");

let cardConfigs = yaml.parse(
    fs.readFileSync("cards.yaml", "utf8")
);

var existingTag
for (let cardFilename in cardConfigs) {
    console.log("UPDATING MARKDOWN FILE WITH GURU TAG")
    let markdownFile = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
    let arr = markdownFile.split(/\r?\n/);
    let h2Regex = /^## \w+/
    var linesThatNeedH2Tags = []
    var existingH2TagLines = []
    var uniqueH2Tags = []
    var lineArray
    // idx - zero-indexed file line number
    // line - content of a given file line number (aka idx)
    arr.forEach((line, idx) => {
        if (line.includes("UUID Guru Tag -**")) {
            y = line.split(" ")
            existingTag = lineArray[lineArray.length - 1]
            return true
        } else if (line.indexOf("**UUID H2 Guru Tag -** ") == 0) {
            console.log("This line is an existing H2 Tag...")
            // add file line number to list
            existingH2TagLines.push(idx)

            // add tag to list of unqiue h2 tags
            lineArray = line.split(" ")
            uniqueH2Tags.push(lineArray[lineArray.length - 1])
            console.log("Exising H2 Tag Lines", existingH2TagLines)
            return true
        } else if (h2Regex.test(line)) {
            console.log("This line needs an H2 Tag...", idx + 1)
            linesThatNeedH2Tags.push(idx + 1)
            return true
        } else {
            return false
        }
    });

    if (linesThatNeedH2Tags.length !== 0) {
        let codeBlockLinesToSkip = getCodeBlockLinesToSkip(arr)
        console.log("CODE BLOCK LINES TO SKIP", codeBlockLinesToSkip)

        linesThatNeedH2Tags = linesThatNeedH2Tags.filter(lineThatNeedsH2 => !existingH2TagLines.includes(lineThatNeedsH2))
        console.log("These lines will have new H2 tags...", linesThatNeedH2Tags)
        for (let i = 0; i < linesThatNeedH2Tags.length; i++) {
            let lineToCheck = linesThatNeedH2Tags[i]
            skipIndex = arrayIncludesElement(index)
            if ((!existingH2TagLines.includes(lineToCheck)) && (!arrayIncludesElement(codeBlockLinesToSkip, lineToCheck))) {
                console.log(`Generating H2 Tag for line ${lineToCheck} `)
                let uniqueH2TagValue = uuidv4()
                let uniqueH2TagValueToWrite = `**UUID H2 Guru Tag -** ${uniqueH2TagValue}`

                arr.splice(lineToCheck + i, 0, uniqueH2TagValueToWrite); // insert new tag into file lines array
                uniqueH2Tags.push(uniqueH2TagValue) // add the newly created H2 tag into list of all H2 tags
            }
        }
        let newFileData = arr.join("\n"); // create the new file
        let file = fs.writeFileSync(path.resolve(`${cardFilename}`), newFileData, { encoding: "utf8" }); // save it
        console.log(`Added new unique tags to H2s`, uniqueH2Tags);
    }


    if (!existingTag) {
        console.log("No existing tag... creating one now")
        let uniqueTagValue = uuidv4()
        let uniqueTagValueToWrite = `\n***\n**UUID Guru Tag -** ${uniqueTagValue}`;

        let stream = fs.createWriteStream(path.resolve(`${cardFilename}`), { flags: 'as' })
        stream.write(`${uniqueTagValueToWrite}`)
        stream.end();
    }
    // reset existing tag to empty string for the next pass
    existingTag = ''
}


function getInclusiveRange(arrayOfRanges) {
    // if the array of ranges is not empty, exit the function
    if (arrayOfRanges == undefined || arrayOfRanges.length == 0) {
      return
    }
  
    // Validate edge/start
    edge = arrayOfRanges[1] || 0;
    start = arrayOfRanges[0]
    step = 1
  
    // Create array of numbers, stopping before the edge
    let arr = [];
    for (arr; (edge - start) * step > 0; start += step) {
      arr.push(start);
    }
    arr.push(edge)
    return arr;
  }
  
  function getCodeBlockLinesToSkip(splitContentArray) {
    let codeBlockRegex = /^`{3}$/
  
    // get all the indices where we see triple-backticks at the start of a line
    // eg. [13, 19, 45, 47, 99, 103]
    let codeBlockIndices = splitContentArray.map((line, index) => {
      if (codeBlockRegex.test(line)) {
        return index
      }
    }).filter(index => Number.isInteger(index));
  
    // exit function if nothing found
    if (codeBlockIndices.length === undefined || codeBlockIndices.length === 0) {
      return
    }
  
    // create an array of arrays consisting of index pairs, demarking the start of a code block and its end
    // eg. [[13, 19], [45, 47], [99 - 103]]
    let indexPairsToSkip = codeBlockIndices.reduce((result, value, index, array) => {
      if (index % 2 === 0)
        result.push(array.slice(index, index + 2));
      return result;
    }, []);
  
    // create an array of arrays consisting of the ranges based on the index pairs
    // eg. [[13, 14, 15, 16, 17, 18, 19], [45, 46, 47], [99, 100, 101, 102, 103]]
    return getInclusiveRange(indexPairsToSkip)
  }

  function arrayIncludesElement(array, element) {
    // checks if an element is inside of an array and returns true if found
    // eg. [[13, 14, 15, 16, 17, 18, 19], [45, 46, 47], [99, 100, 101, 102, 103]]
    JSON.stringify(array).includes(element)
  }