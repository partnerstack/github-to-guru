// // read.js
// const fs = require('fs');
// const yaml = require('js-yaml');

// try {
//     let fileContents = fs.readFileSync('./cards.yaml', 'utf8');
//     let data = yaml.load(fileContents);

//     console.log(data);
// } catch (e) {
//     console.log(e);
// }


const fs = require('fs');
const yaml = require('js-yaml');
const path =  require('path');

let teamId = "process.env.GURU_TEAM_ID"
let tagCategoryName = "UnderDok Tags"
let verificationInterval = 30

// let cardFileName = ""

// 1. Go through all the directories
// 2. Get the path for any files that have the .md extension
// 3. For each of the files, map them to the key of an existing data entry by the same title
// 4. For each data entry, if the entry is not in the map of current .md files,
// create a list of them so we know to delete them from Guru
// 5. Remove the entry to be deleted from the data object
// 6. For each item in the map from step 3 that does not have an existing data value, create
// a new entry in the data object
// 7. Output file

let data = {
    // cardFileName: {
    "hello/world/canada/README3.md": {
        Title: "Pstack GitHub-to-Guru Readme II",
        TeamId: teamId,
        TagCategoryName: tagCategoryName,
        VerificationInterval: verificationInterval,
        VerificationEmail: "shannon.curnew@partnerstack.com",
        VerificationFirstName: "Shannon",
        VerificationLastName: "Curnew",
    },
    // cardFileName: {
    "hello/world/canada/README4.md": {
        Title: "Pstack GitHub-to-Guru Readme II",
        TeamId: teamId,
        TagCategoryName: tagCategoryName,
        VerificationInterval: verificationInterval,
        VerificationEmail: "shannon.curnew@partnerstack.com",
        VerificationFirstName: "Shannon",
        VerificationLastName: "Curnew",
    }
}

let yamlStr = yaml.dump(data);
fs.writeFileSync('data-out.yaml', yamlStr, 'utf8');
