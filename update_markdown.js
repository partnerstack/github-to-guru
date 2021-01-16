const yaml = require("yaml");
const fs = require(`fs-extra`);
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { Console } = require("console");

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
    let codeBlockLinesToSkip = getCodeBlockLinesToSkip(arr)
    // index - zero-indexed file line number
    // line - content of a given file line number (aka index)
    arr.forEach((line, index) => {
        if (line.includes("UUID Guru Tag -**")) {
            lineArray = line.split(" ")
            existingTag = lineArray[lineArray.length - 1]
            return true
        } else if (line.indexOf("**UUID H2 Guru Tag -** ") == 0) {
            console.log("This line is an existing H2 Tag...")
            // add file line number to list
            existingH2TagLines.push(index)

            // add tag to list of unqiue h2 tags
            lineArray = line.split(" ")
            uniqueH2Tags.push(lineArray[lineArray.length - 1])
            console.log("Exising H2 Tag Lines", existingH2TagLines)
            return true
        } else if (h2Regex.test(line)) {
            // TODO - fix this so it doesn't include H3s

            console.log("This line maybe needs an H2 Tag...", index + 1)
            console.log("CODE BLOCK LINES TO SKIP", codeBlockLinesToSkip)

            let skipIndex
            if (codeBlockLinesToSkip !== undefined) {
                skipIndex = arrayIncludesElement(codeBlockLinesToSkip, index + 1)
            }
            console.log("SKIP INDEX", skipIndex)

            if (skipIndex == false) {
                console.log("This line definitely needs an H2 Tag", index + 1)
                linesThatNeedH2Tags.push(index + 1)
                return true
            } else {
                console.log("This line does not need an H2 Tag")
                return false
            }

        } else {
            return false
        }
    });

    if (linesThatNeedH2Tags.length !== 0) {
        linesThatNeedH2Tags = linesThatNeedH2Tags.filter(lineThatNeedsH2 => !existingH2TagLines.includes(lineThatNeedsH2))
        console.log("These lines will have new H2 tags...", linesThatNeedH2Tags)
        for (let i = 0; i < linesThatNeedH2Tags.length; i++) {
            let lineToCheck = linesThatNeedH2Tags[i]

            if (!existingH2TagLines.includes(lineToCheck)) {
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


// function range(start, edge, step) {
//   // If only 1 number passed make it the edge and 0 the start
//   if (arguments.length === 1) {
//     edge = start;
//     start = 0;
//   }

//   // Validate edge/start
//   edge = edge || 0;
//   step = step || 1;

//   // Create array of numbers, stopping before the edge
//   let arr = [];
//   for (arr; (edge - start) * step > 0; start += step) {
//     arr.push(start);
//   }
//   return arr;
// }

// TODO - FIX THIS... IT TAKES AN ARRAY OF ARRAYS... WHICH MEANS WE GOTTA LOOP THROUGH AND TO THE BELOW LOGIC FOR EACH SUBARRAY
function getInclusiveRange(array) {
  // Exit early if there's nothing to get a range for
  if (array.length === 0 || array == undefined) {
    return
  }

  // Validate edge/start
  let start = array[0]
  let edge = array[1];
  let step = 1;

  // Create array of numbers, stopping before the edge
  let arr = [];
  for (arr; (edge - start) * step > 0; start += step) {
    arr.push(start);
  }
  // Include the tail-edge of the array
  arr.push(edge);
  return arr;
}
  
  function getCodeBlockLinesToSkip(splitContentArray) {
    let codeBlockRegex = /^`{3}$/
    let inclusiveArrayRanges = []
  
    // get all the indices where we see triple-backticks at the start of a line
    // eg. [13, 19, 45, 47, 99, 103]
    let codeBlockIndices = splitContentArray.map((line, index) => {
      if (codeBlockRegex.test(line)) {
        console.log("Found a line with triple back ticks...", line)
        console.log("Here's the index", index)
        return index
      }
    }).filter(index => Number.isInteger(index));
  
    // exit function if nothing found
    if (codeBlockIndices.length === undefined || codeBlockIndices.length === 0) {
        console.log("Exiting 'getCodeBlockLinesToSkip' because no triple backticks were found, so no indices were logged")
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
    for (let i = 0; i < indexPairsToSkip.length; i++) {
      let inclusiveRange = getInclusiveRange(indexPairsToSkip[i])
      inclusiveArrayRanges.push(inclusiveRange)
    }
    return inclusiveArrayRanges
  }

  function arrayIncludesElement(array, element) {
    // checks if an element is inside of an array and returns true if found
    // eg. [[13, 14, 15, 16, 17, 18, 19], [45, 46, 47], [99, 100, 101, 102, 103]]
    return JSON.stringify(array).includes(element)
  }