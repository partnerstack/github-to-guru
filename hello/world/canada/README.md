# GitHub to Guru - PStack Version
Updating the Github-to-Guru action with Pstack flair.

## How to set up a GitHub to Guru integration!!

1. Set up Secrets in your Repo by going to Settings > Secrets. You will need `GURU_COLLECTION_ID`, `GURU_USER_EMAIL` and `GURU_USER_TOKEN`. You can generate the user token via the Guru web app. The Guru Collection ID can be found by inspecting the network tab of your browser inspector when checking out a Collections page.

2. Create a `cards.yaml` file in the root directory. Here is an example of what the file should contain:
```
README.md:
  Tags:
    - "DOK Readme"
    - "Documentation"
    - "Readme"
  Title: "DOK Readme"
  UniqueTagValue: "999"
  TeamId: "1uvrh"
  TagCategoryName: "Github-to-Guru Card ID Tags"
  VerificationInterval: 30
  VerificationEmail: "shannon.curnew@partnerstack.com"
  VerificationFirstName: "Shannon"
  VerificationLastName: "Curnew"

docs/common/documentation.md:
  Tags:
    - "Hackathon progress"
    - "Updates"
    - "Readme"
  Title: "Common Documentation"
  UniqueTagValue: "888"
  TeamId: "hfvvy"
  TagCategoryName: "Github-to-Guru Card ID Tags"
  VerificationInterval: 30
  VerificationEmail: "shannon.curnew@partnerstack.com"
  VerificationFirstName: "Shannon"
  VerificationLastName: "Curnew"

```

3. Create a `collections` directory in root. Create a `collections.yaml` file in the `collections` directory. Here is an example of what you may paste in:
```
Tags:
  - Documentation:Readme
```

4. Create a `.github/workflow` directory in root. Create a `main.yml` file in this directory. Paste in the following:
```
name: Create guru cards
on:
  push:
    branches:
      - master
jobs:
  guru:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: partnerstack/github-to-guru@master
        env:
          GURU_USER_EMAIL: "${{ secrets.GURU_USER_EMAIL }}"
          GURU_USER_TOKEN: "${{ secrets.GURU_USER_TOKEN }}"
          GURU_COLLECTION_ID: "${{ secrets.GURU_COLLECTION_ID }}"
          GURU_COLLECTION_YAML: "collections/collection.yaml"
          GURU_CARD_YAML: "cards.yaml"
```
Every time you push a commit to master, you can check out the Actions tab to view the queued jobs from your `main.yml` file.

## DOK Heading Hierarchy
### Adding a New Theme
A Theme is a top level project or collection of documents under the docs folder.

It must contain a README.md file with the following format:
```
# <THEME TITLE>

<Short few sentence description>

## <HEADING>
```

## How to Split a DOK File into Guru
1. Fetch the file (eg. `README.md`)
2. Fetch the file's relative path and create a tag from it (eg. `hello/world/canada/README.md`)
3. If it doesn't already have one, generate a UUID and append it to the file (eg. `23sfljb039130coifdf`)
4. For each H2 in the file, if it doesn't already have one, also generate a UUID and append it directly under the H2. We can do this like so:
(see https://nodejs.org/api/fs.html#fs_fs_createwritestream_path_options and https://stackoverflow.com/questions/58582161/is-it-possible-to-write-text-in-the-middle-of-a-file-with-fs-createwritestream)
```
const fs = require("fs");

const fileData = fs.readFileSync("result.csv", { encoding: "utf8" });
const fileDataArray = fileData.split("\n");
const newData = "5258,525,98951,0,1";
const index = 2; // after each row to insert your data

fileDataArray.splice(index, 0, newData); // insert data into the array

const newFileData = fileDataArray.join("\n"); // create the new file

fs.writeFileSync("result.csv", newFileData, { encoding: "utf8" }); // save it
```

OUR EXAMPLE:
```
  // 1. Search card line by line and find the H2 tags
  let file = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
  let arr = file.split(/\r?\n/);
  var existingH2Tag = {}
  arr.forEach((line, idx) => {
    if (line.includes("UUID H2 GURU TAG -**")) {
      let line_arr = line.split(" ")
      // `idx-1` under the assumption that the tag is on the line immediately after the H2
      existingH2Tag[`h2line${idx-1}`] = line_arr[line_arr.length - 1]
      return true
    } else {
      existingH2Tag[`h2line${idx-1}`] = null
      return false
    }
  });

  let uniqueTagValue
  let content
  // for key in `existingH2Tag`
  if (existingH2Tag.key == null) {
    console.log(`${existingH2Tag.key} has no existing H2 Tag. Generating... `)
    uniqueTagValue = uuidv4()
    let uniqueTagValueToWrite = `\n***\n**UUID H2 Guru Tag -** ${uniqueTagValue}`

    // TODO - check example above
    arr.splice(index, 0, uniqueTagValueToWrite); // insert new tag into file lines array

    let newFileData = arr.join("\n"); // create the new file
    file = fs.writeFileSync("result.csv", newFileData, { encoding: "utf8" }); // save it
    console.log(`Added new unique tags to H2s`);
    content = file

  } else {
    console.log(`existingH2Tag: `, existingH2Tag.key)
    uniqueTagValue = existingH2Tag
    content = file
  }
```
5. Create/update a card for each H2

## TODO LIST - Updated
1. Figure out how to set a group of users as the verifier.
2. Figure out if we can make cards for nested files.
3. Create a `createBoard` function.
4. Create an `updateBoard` function.
5. Figure out how to add Cards to Boards
6. Figure out how to create separate Cards from markdown sections (in DOK)
7. Figure out how to create Board Sections
8. Clean up callback hell + incorrect error messages.
9. Figure out why an "error" is being thrown even though everything works... Likely has to do with the call to the "unverify" API and the fact that I'm sending it an empty request body (which is fine, because it won't accept anything anyway, but it probably just doesn't like the empty JSON object).
10. Figure out how to dynamically switch up `git config --local user.name "asyi"`
11. Figure out how to add cards to Board
12. Figure out how to add cards to Board Section


STEPS FOR MOVING CARDS TO NESTED BOARD SECTION (note - this depends on the top-level Collection ("cards not on a board") never containing manually-made and/or free-floating cards... the idea is that we'll programatically generate a card, which gets put in this "cards not on a board" bucket, then we do the following to immediately class it in a sub board somewhere... unless the guru CS people get back to me on how to programatically create a new card within a section)
1. GET - the board to which you want to move things... you can get board by `id` or get all `boards` and figure it out from there.
2. GET - the {{card_id}} of the card in question
3. POST - https://api.getguru.com/api/v1/cards/{{card_id}}/boards/ - move the card from the Collection to the nested Board Group of choice (Board Groups can be nested up to 2 levels deep) where the value of the Request's `id` is the the {{board_id}}.
4. POST - https://api.getguru.com/api/v1/boards/{{board_id}}/entries - Use the Response Body's `itemID` from step 2 as the value of this Request Body's `BoardEntries[i].id`.