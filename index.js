"use strict";

const axios = require(`axios`);

const fs = require(`fs-extra`);

const tmp = require(`tmp`);

const yaml = require("yaml");

const core = require(`@actions/core`);

const exec = require("@actions/exec");

const github = require(`@actions/github`);

const querystring = require("querystring");

const path = require("path");

const { v4: uuidv4 } = require("uuid");
const { Z_ASCII } = require("zlib");

async function getCollection(auth, collectionId) {
  console.log(`collection: ${collectionId}`);
  return axios.get(
    `https://api.getguru.com/api/v1/collections/` + collectionId,
    {
      auth: auth
    }
  );
}

async function apiSendSynchedCollection(sourceDir, auth, collectionId) {
  let options = {};
  options.cwd = sourceDir;
  await exec.exec(`zip`, [`-r`, `guru_collection.zip`, `./`], options);

  if (process.env.DEBUG) {
    console.log(
      `DEBUG mode: not deploying ${sourceDir}/guru_collection.zip to https://api.getguru.com/app/contentsyncupload?collectionId=${collectionId}`
    );
  } else {
    await exec.exec(
      `curl -u ${auth.username}:${auth.password} https://api.getguru.com/app/contentsyncupload?collectionId=${collectionId} -F "file=@${sourceDir}/guru_collection.zip" -D -`
    );
  }
}

function getInclusiveRange(arrayOfRanges) {
  // if the array of ranges is not empty, exit the function
  if (arrayOfRanges == undefined || arrayOfRanges.length == 0) {
    return
  }

  // Validate edge/start
  let edge = arrayOfRanges[1] || 0;
  let start = arrayOfRanges[0]
  let step = 1

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

function getH2ContentKeyMap(content) {
  // take the content and split it off into sub-content based on the H2 tag
  let h2ContentKeyMap = []
  let tagAndContentIndicesList = []
  let contentIndexAndTagList = []
  let contentIndexAndH2TitleMap = []
  let splitContentArray = content.split(/\r?\n/);
  let lastContentLineNumber
  let h2Regex = /^## \w+/;

  let codeBlockLinesToSkip = getCodeBlockLinesToSkip(splitContentArray)
  console.log("CODE BLOCK LINES TO SKIP", codeBlockLinesToSkip)

  splitContentArray.map((line, index) => {
    // if there are code blocks in the content, we'll want to skip over their lines when getting the H2ContentKeyMap
    if (codeBlockLlinesToSkip !== undefined) {
      skipIndex = arrayIncludesElement(index)
    }
    if (h2Regex.test(line) && !skipIndex) {
        // if we run into an H2, map line number to the h2 content eg. [{83: "## Title"}, {98: "## Title2"}]
        contentIndexAndH2TitleMap.push({
                [index]: line
            })
        // also map corresponding unique tag to line number eg. [{84: "aljd1j312412j3421"}, {99: "10293daf210adg9124"}]
        let h2Tag = splitContentArray[index + 1].split(" ").slice(-1)[0]
        contentIndexAndTagList.push({
            [index + 1]: h2Tag
        })
    }
    // store the last line in the content that is not the parent UUID and breakline
    if (splitContentArray.length - 3 === index) {
        lastContentLineNumber = index
    }
  })

  // map h2 tag to content line numbers eg. x = [{ ["10293daf210adg9124"]: [83: 97]}, {["aljd1j312412j3421"]: [98: 101]}]
  contentIndexAndTagList.map((lineAndTag, index) => {
      let tag = Object.values(lineAndTag)
      let firstLineNumber = parseInt(Object.keys(contentIndexAndH2TitleMap[index]))
      let lastLineNumber
      if (index !== contentIndexAndTagList.length - 1) {
          lastLineNumber = Object.keys(contentIndexAndTagList[index+1]) - 1
          tagAndContentIndicesList.push({
              [tag]: [firstLineNumber, lastLineNumber]
          })

      } else {
          tagAndContentIndicesList.push({
              [tag]: [firstLineNumber, lastContentLineNumber]
          })
      }
  })

  // then we want to create a map of the actual content to the ky
  // eg. y = [{ 10293daf210adg9124: "i am the content" }, {aljd1j312412j3421: "I am some more content"}]

  tagAndContentIndicesList.map((tagAndLines, index) => {
    let tag = Object.keys(tagAndLines)
    let h2Indices = Object.values(tagAndLines)
    let h2Content = splitContentArray.slice(h2Indices[0][0], h2Indices[0][1]).join('\n')

    let tagMap = {}
    tagMap[tag] = h2Content

    h2ContentKeyMap.push(tagMap)

  })
  return {
    h2ContentKeyMap: h2ContentKeyMap,
    contentIndexAndH2TitleMap: contentIndexAndH2TitleMap
  }
}

function getH2ContentForKey(h2ContentKeyMap, uniqueTagValue) {
  for (let i = 0; i < h2ContentKeyMap.length; i++) {
        let tag = Object.keys(h2ContentKeyMap[i])
        if (tag.includes(uniqueTagValue)){
            return h2ContentKeyMap[i][uniqueTagValue]
        }
  }
}

function splitCardFilename(cardFilename) {
  // given a cardFilename, split it into
  // board group, board, board section, card name
  // depending on the number of slashes
  console.log(`Splitting the cardFilename ${cardFilename} by slash...`)
  let cardPathArray = cardFilename.split("/")
  let cardPaths = {}

  switch (cardPathArray.length) {
    case 1:
      console.log(`Only found a cardName ${cardPathArray[0]}`)
      cardPaths[`cardName`] = cardPathArray[0]
      return cardPaths
    case 2:
      console.log(`Found boardName ${cardPathArray[1]} and cardName ${cardPathArray[0]}`)
      cardPaths[`boardName`] = cardPathArray[0]
      cardPaths[`cardName`] = cardPathArray[1]
      return cardPaths
    case 3:
      console.log(`Found boardGroupName ${cardPathArray[0]}, boardName ${cardPathArray[1]} and cardName ${cardPathArray[2]}`)
      cardPaths[`boardGroupName`] = cardPathArray[0]
      cardPaths[`boardName`] = cardPathArray[1]
      cardPaths[`cardName`] = cardPathArray[2]
      return cardPaths
    case 4:
      console.log(`Found boardGroupName ${cardPathArray[0]}, boardName ${cardPathArray[1]}, boardSectionName ${cardPathArray[2]} and cardName ${cardPathArray[3]}`)
      cardPaths[`boardGroupName`] = cardPathArray[0]
      cardPaths[`boardName`] = cardPathArray[1]
      cardPaths[`boardSectionName`] = cardPathArray[2]
      cardPaths[`cardName`] = cardPathArray[3]
      return cardPaths
  }
}

async function apiCreateCard(
  headers,
  title,
  content,
  collectionId,
  tags,
  verificationInterval,
  verificationEmail,
  verificationFirstName,
  verificationLastName,
  utcDate
) {
  try {
    let cardData = {
      preferredPhrase: title,
      content: content,
      boards: [
        {
          // TODO - figure out how to dynamically get/create board id
          id: "c422a42b-891f-4537-988e-2ed7a1c39237",
          action: {
            // TODO - using board id, figure out how to dynmaically get/create board sectionId
            // This can be done by making a capp to '/api/v1/boards/{id}'
            sectionId: "3d7801a3-61c3-45f4-a681-1f2110d9c782",
            actionType: "add",
            // if prevSiblingItem is same as board id, card will be added to top of section
            prevSiblingItem: "3d7801a3-61c3-45f4-a681-1f2110d9c782"
          }
        }
      ],
      htmlContent: false,
      collection: {
        id: collectionId
      },
      shareStatus: "TEAM",
      // tags: [response.data],
      tags: tags,
      verificationState: "NEEDS_VERIFICATION",
      verificationInterval: verificationInterval,
      verifiers: [
        {
          type: "user",
          user: {
            status: "ACTIVE",
            email: verificationEmail,
            firstName: verificationFirstName,
            lastName: verificationLastName
          },
          id: verificationEmail,
          dateCreated: utcDate
        }
      ],
      // verifiers: [
      //   {
      //     "type": "user-group",
      //     "userGroup": {
      //       "id": "35725837-184a-4f83-8774-778a8a84f967",
      //       "dateCreated": "2020-07-07T17:33:52.218+0000",
      //       "groupIdentifier": "team",
      //       "expertIdRank": 1,
      //       "numberOfCardsAsVerifier": 0,
      //       "numberOfMembers": 0,
      //       "modifiable": false,
      //       "name": "All Members"
      //     }
      //   }
      // ],
      verificationInitiator: {
        status: "ACTIVE",
        email: "althea.yi@partnerstack.com",
        firstName: "Althea",
        lastName: "Yi"
      },
      verificationReason: "NEW_VERIFIER"
    };
    console.log(`Making the card create request to Guru  now with ${JSON.stringify(cardData)}`)
    return await axios.post(
      `https://api.getguru.com/api/v1/facts/extended`,
      cardData,
      headers
    ).then((response) => {
      console.log("Response", response);
    }).catch((error) => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
        throw `A card create request was made, but received a bad response...\n Status: ${error.response.status} \n Response data: ${error.response.data}; \n Response headers: ${error.response.headers}`
      } else if (error.request) {
        throw `A card create request was made but no response was received: ${error.request}`
      } else {
        // Something happened in setting up the request that triggered an Error
        throw `There was an issue with setting up the card create request: ${error.request}`
      }
    })
  } catch (error) {
    core.setFailed(
      `Unable to create card: ${error}`
    );
  }
}

async function getOrCreateBoardsAndCards(
  cardPaths,
  headers,
  title,
  content,
  collectionId,
  tags,
  verificationInterval,
  verificationEmail,
  verificationFirstName,
  verificationLastName,
  utcDate
) {
  try {
    console.log(`Getting/creating boards and cards now... cardPaths contains ${Object.keys(cardPaths).length} elements`)
    let boardGroupName
    let boardName
    let boardSectionName
    let cardName
    switch (Object.keys(cardPaths).length) {
      case 1:
        // create a top-level card in the collection
        console.log("Creating/Getting top-level Card")
        await apiCreateCard(
          headers,
          title,
          content,
          collectionId,
          tags,
          verificationInterval,
          verificationEmail,
          verificationFirstName,
          verificationLastName,
          utcDate
        )
        break;
      case 2:
        // get/create a board and add card to the board
        boardName = cardPaths.boardName
        cardName = cardPaths.cardName
        console.log("Creating/Getting Board and Card")

        await apiCreateCard(
          headers,
          title,
          content,
          collectionId,
          tags,
          verificationInterval,
          verificationEmail,
          verificationFirstName,
          verificationLastName,
          utcDate
        )
        break;
      case 3:
        // get/create a board group
        // get/created a nested board
        // add card to nested board
        console.log("Creating/Getting Board Group, Board and Card")
        boardGroupName = cardPaths.boardGroupName
        boardName = cardPaths.boardName
        cardName = cardPaths.cardName

        await apiCreateCard(
          headers,
          title,
          content,
          collectionId,
          tags,
          verificationInterval,
          verificationEmail,
          verificationFirstName,
          verificationLastName,
          utcDate
        )
        break;
      case 4:
        console.log("Creating/Getting Board Group, Board, Board Section and Card")
        // get/create board group
        // get/create a nested board
        // get/create nested board section
        // add card to nested board section
        boardGroupName = cardPaths.boardGroupName
        boardName = cardPaths.boardName
        boardSectionName = cardPaths.boardSectionName
        cardName = cardPaths.cardName

        try {
          await apiCreateCard(
            headers,
            title,
            content,
            collectionId,
            tags,
            verificationInterval,
            verificationEmail,
            verificationFirstName,
            verificationLastName,
            utcDate
          )
          break;
        } catch (error) {
          core.setFailed(
            `Creating the card for case 4 Failed: ${error.message}`
          );
        }
    }
  } catch (error) {
    core.setFailed(
      `Unable to create boards and cards: ${error.message}`
    );
  }

}

async function apiGetTagIdByTagValue(auth, teamId, tagCategoryName, uniqueTagValue) {
  // 1. get all tag categories
  let uniqueTagId
  try {
    await apiGetAllTagCategories(
      auth,
      teamId
    ).then((response) => {
      if (response.data !== undefined) {
        let tagCategoryIndex = getTagCategoryIndexByName(response.data, tagCategoryName)

        if (tagCategoryIndex !== -1) {
          console.log("Found a tag category with the target name", tagCategoryName)
          let tagsInCategory = getTagsInCategory(response.data, tagCategoryIndex)

          let desiredTag = getTagByValue(tagsInCategory, uniqueTagValue)

          if (desiredTag !== undefined) {
            uniqueTagId = desiredTag.id
          } else {
            uniqueTagId = null
          }
        }
      }
    })
    console.log("unique tag id:", uniqueTagId)
    return uniqueTagId
  } catch (error) {
    core.setFailed(`Unable to get Tag Id by Tag Value: ${error.message}`);
  }
}

async function apiCreateTags(headers, teamId, tagData) {
  try {
    return await axios.post(
      `https://api.getguru.com/api/v1/teams/${teamId}/tagcategories/tags/`,
      tagData,
      headers
    )
  } catch (error) {
    core.setFailed(`Unable to create tags: ${error.message}`);
  }
}

async function apiUnverifyCard(headers, cardId, postData) {
  try {
    console.log(`Unverifying updated card.`);
    return await axios.post(
      `https://api.getguru.com/api/v1/cards/${cardId}/unverify`,
      { postData },
      headers
    );
  } catch (error) {
    core.setFailed(`Could not unverify card: ${error.message}`);
  }
}

async function apiSendStandardCard(
  auth,
  collectionId,
  title,
  teamId,
  tagCategoryName,
  verificationInterval,
  verificationEmail,
  verificationFirstName,
  verificationLastName,
  cardFilename
) {
  console.log(`Creating or Updating card in ${collectionId}: ${title}`);
  let headers = {
    auth: auth,
    "content-type": `application / json`
  };
  // 0. Parse file to see if it has tags... if it doesn't, create some and add to file
  let file = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
  let arr = file.split(/\r?\n/);
  var existingTag

  let h2Regex = /^## \w+/
  var linesThatNeedH2Tags = []
  var existingH2TagLines = []
  var uniqueH2Tags = []
  var existingTag
  var lineArray

  // idx - zero-indexed file line number
  // line - content of a given file line number (aka idx)
  arr.forEach((line, idx) => {
    if (line.includes("UUID Guru Tag -**")) {
      lineArray = line.split(" ")
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
      // TODO - fix this so it doesn't include H3s
      console.log("This line needs an H2 Tag...", idx + 1)
      linesThatNeedH2Tags.push(idx + 1)
      return true
    } else {
      return false
    }
  });

  if (linesThatNeedH2Tags.length !== 0) {
    linesThatNeedH2Tags = linesThatNeedH2Tags.filter(lineThatNeedsH2 => !existingH2TagLines.includes(lineThatNeedsH2))
    console.log("These lines will have new H2 tags...", linesThatNeedH2Tags)
    for (let i = 0; i < linesThatNeedH2Tags.length; i++) {
      if (!existingH2TagLines.includes(linesThatNeedH2Tags[i])) {
        console.log(`Generating H2 Tag for line ${linesThatNeedH2Tags[i]} `)
        let uniqueH2TagValue = uuidv4()
        let uniqueH2TagValueToWrite = `**UUID H2 Guru Tag -** ${uniqueH2TagValue}`

        arr.splice(linesThatNeedH2Tags[i] + i, 0, uniqueH2TagValueToWrite); // insert new tag into file lines array
        uniqueH2Tags.push(uniqueH2TagValue) // add the newly created H2 tag into list of all H2 tags
        // add file line number to list
        existingH2TagLines.push(linesThatNeedH2Tags[i] + i)
      }
    }
    let newFileData = arr.join("\n"); // create the new file
    let file = fs.writeFileSync(path.resolve(`${cardFilename}`), newFileData, { encoding: "utf8" }); // save it
    console.log(`Added new unique tags to H2s`, uniqueH2Tags);
  }

  let uniqueTagValue
  let content
  if (!existingTag) {
    console.log(`${cardFilename} has no existing Tag. Generating... `)
    uniqueTagValue = uuidv4()
    let uniqueTagValueToWrite = `\n***\n**UUID Guru Tag -** ${uniqueTagValue}`

    let stream = fs.createWriteStream(path.resolve(`${cardFilename}`), { flags: 'as' })
    stream.write(`${uniqueTagValueToWrite}`)
    stream.end()
    file = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
    console.log(`Appended a unique tag to ${cardFilename}: ${uniqueTagValueToWrite}`);
    content = file

  } else {
    console.log(`${cardFilename} has an existingTag: `, existingTag)
    uniqueTagValue = existingTag
    content = file
  }

  // CREATE THE "PARENT" CARD
  if (process.env.GURU_CARD_YAML && uniqueTagValue) {
    // 0. Get all tags and get the tag id of the tag whose value is uniqueTagValue and pass it along to `apiSearchCardByTagId`
    let uniqueTagId = await apiGetTagIdByTagValue(auth, teamId, tagCategoryName, uniqueTagValue)
    console.log("EXISTING UNIQUE TAG VALUE's TAG ID", uniqueTagId)

    // 1a. If unique tag exists in Guru, find related card using the tag id and update.
    if (uniqueTagId !== null) {
      await findAndUpdateCard(
        uniqueTagId,
        auth,
        title,
        verificationInterval,
        verificationEmail,
        verificationFirstName,
        verificationLastName,
        content,
        headers,
        collectionId
      )
    } else {
      // 1b. If unique tag does not exist in Guru, call to create a new unique tag and then a new card with said tag.
      console.log("Creating a new unique tag with team id", teamId);
      createTagAndCard(
        uniqueTagValue,
        auth,
        title,
        verificationInterval,
        verificationEmail,
        verificationFirstName,
        verificationLastName,
        content,
        headers,
        teamId,
        tagCategoryName,
        cardFilename,
        collectionId
      )
    }
  }

  // CREATE THE "CHILDREN" CARD BASED ON H2s IN THE PARENT CARD
  // TODO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // For each unique H2 Tag, create a brand new card.
  // Use only the `content` from the H2 tag up until the next H2 tag
  // (or until it's the end of the file - figure out the OR logic)
  // make a `getH2ContentKeyMap` function to serve this purpose
  // content = getH2ContentKeyMap(content, uniqueH2Tags, existingH2TagLines)
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  if (process.env.GURU_CARD_YAML && uniqueH2Tags) {
    let {h2ContentKeyMap, contentIndexAndH2TitleMap} = getH2ContentKeyMap(content)
    for (let i = 0; i < uniqueH2Tags.length; i++) {
      let uniqueTagValue = uniqueH2Tags[i]
      console.log("uniqueTagValue", uniqueTagValue)
      content = getH2ContentForKey(h2ContentKeyMap, uniqueTagValue)

      console.log("\n\n\nH2 CHILD CARD CONTENT", content + "\n\n\n")

      let updatedH2Title = title + " - " + Object.values(contentIndexAndH2TitleMap[i])[0]
      console.log("UPDATED TITLE", updatedH2Title)

      let uniqueTagId = await apiGetTagIdByTagValue(auth, teamId, tagCategoryName, uniqueTagValue)
      console.log("Existing unique H2 tag ID", uniqueTagId)

      // 1a. If unique tag exists in Guru, find related 'child' card using the tag id and update.
      if (uniqueTagId !== null) {
        await findAndUpdateCard(
          uniqueTagId,
          auth,
          updatedH2Title,
          verificationInterval,
          verificationEmail,
          verificationFirstName,
          verificationLastName,
          content,
          headers,
          collectionId
        )
      } else {
        // 1b. If unique tag does not exist in Guru, call to create a new unique tag and then a new 'child' card with said tag.
        console.log("Creating a new unique tag with team id", teamId);

        createTagAndCard(
          uniqueTagValue,
          auth,
          updatedH2Title,
          verificationInterval,
          verificationEmail,
          verificationFirstName,
          verificationLastName,
          content,
          headers,
          teamId,
          tagCategoryName,
          cardFilename,
          collectionId
        )
      }
    }
  }
}

function createTagAndCard(
  uniqueTagValue,
  auth,
  title,
  verificationInterval,
  verificationEmail,
  verificationFirstName,
  verificationLastName,
  content,
  headers,
  teamId,
  tagCategoryName,
  cardFilename,
  collectionId) {
  try {
    apiGetAllTagCategories(
      auth,
      uniqueTagValue,
      teamId,
      tagCategoryName
    ).then((response) => {
      try {
        let tagCategoryId = getTagCategoryIdByName(response.data, tagCategoryName)
        console.log("tag category id????", tagCategoryId);
        let tagData = {
          categoryId: tagCategoryId,
          value: uniqueTagValue
        };
        console.log("Set tag data", tagData);
        try {
          apiCreateTags(headers, teamId, tagData).then((response) => {
            if (response.status !== 200) {
              throw `Request to create tags failed: ${response}`
            }

            console.log("Going to get or create new Boards and Cards");
            let date = new Date();
            let utcDate = date.getUTCDate();
            let cardPaths = splitCardFilename(cardFilename)
            let tags = [response.data]
            console.log(`Retrieved cardFilename paths: ${cardPaths}`)
            try {
              // TODO - parse cardPaths... make calls to make board group/board/board section accordingly
              getOrCreateBoardsAndCards(
                cardPaths,
                headers,
                title,
                content,
                collectionId,
                tags,
                verificationInterval,
                verificationEmail,
                verificationFirstName,
                verificationLastName,
                utcDate
              )
            } catch (error) {
              core.setFailed(`Unable to getorCreateBoardsAndCards: ${error.message}`);
            }
          });
        } catch (error) {
          core.setFailed(`Unable to create tags: ${error.message}`);
        }
      } catch (error) {
        core.setFailed(`Unable to get category id: ${error.message}`);
      }
    });
  } catch (error) {
    core.setFailed(`Unable to get all tag categories: ${error.message}`);
  }
}

async function findAndUpdateCard(
  uniqueTagId,
  auth,
  title,
  verificationInterval,
  verificationEmail,
  verificationFirstName,
  verificationLastName,
  content,
  headers,
  collectionId) {
  try {
    await apiSearchCardByTagId(
      auth,
      uniqueTagId
    ).then((response) => {
      // 1a. If existing tag found (and therefore card exists), call to update existing card by id (not by tag value).
      if (response.data.length >= 1) {
        let cardId = response.data[0].id
        let cardTags = response.data[0].tags
        try {
          console.log(
            `Found existing card with uniqueTagId ${uniqueTagId}`
          );
          apiUpdateStandardCardById(
            auth,
            collectionId,
            title,
            cardId,
            cardTags,
            verificationInterval,
            verificationEmail,
            verificationFirstName,
            verificationLastName,
            content
          ).then((response) => {
            console.log(`Updated card`);

            try {
              let postData = {};
              // need to pass in empty post body or else request will fail
              apiUnverifyCard(headers, cardId, postData)
            } catch (error) {
              core.setFailed(`Unable to unverify card: ${error.message}`);
            }
          });
        } catch (error) {
          core.setFailed(`Unable to update card by Id: ${error.message}`);
        }
      }
    })
  } catch (error) {
    core.setFailed(`Unable to find card: ${error.message}`);
  }
}

function getTagByValue(tags, tagValue) {
  let desiredTag = tags.find(tag => tag.value == tagValue)
  return desiredTag
}

function getTagsInCategory(data, tagCategoryIndex) {
  console.log("Getting all Tags in Category")
  let tagsInCategory = data[tagCategoryIndex].tags.map(tag => tag);
  return tagsInCategory
}

function getTagCategoryIndexByName(data, tagCategoryName) {
  // if the tagCategoryIndex is -1, it means that no tag with tagCategoryName was found
  console.log(`Getting Tag Category Index by Category Name`, tagCategoryName);
  let tagCategoryIndex = data.findIndex(tagCategory => tagCategory.name === tagCategoryName)
  return tagCategoryIndex
}

function getTagCategoryIdByName(data, tagCategoryName) {
  console.log(`Getting Tag Category Id by Category Name`, tagCategoryName);
  let tagCategoryIndex = getTagCategoryIndexByName(data, tagCategoryName)
  if (tagCategoryIndex !== -1) {
    return data[tagCategoryIndex].id
  } else {
    return null
  }
}

async function apiGetAllTagCategories(auth, teamId) {
  try {
    console.log(`Getting all tag categories by team id`);
    return await axios.get(
      `https://api.getguru.com/api/v1/teams/${teamId}/tagcategories`,
      {
        auth: auth
      }
    );
  } catch (error) {
    core.setFailed(`Unable to get tag categories by team Id: ${error.message}`);
  }
}

async function apiSearchCardByTagId(
  auth,
  tagId
) {
  try {
    console.log(
      `Searching for card with Tag ID: ${tagId}`
    );
    return await axios.get(
      `https://api.getguru.com/api/v1/search/query?q=tag-${tagId}%20exists`,
      {
        auth: auth
      }
    );
  } catch (error) {
    core.setFailed(
      `Unable to find card with tagId ${tagId}: ${error.message}`
    );
  }
}

async function apiUpdateStandardCardById(
  auth,
  collectionId,
  title,
  cardId,
  tags,
  verificationInterval,
  verificationEmail,
  verificationFirstName,
  verificationLastName,
  content
) {
  console.log(`Updating card with ID ${cardId}`);
  let headers = {
    auth: auth,
    "content-type": `application/json`
  };
  let date = new Date();
  let utcDate = date.getUTCDate();
  let data = {
    preferredPhrase: title,
    content: content,
    htmlContent: false,
    collection: {
      id: collectionId
    },
    shareStatus: "TEAM",
    id: cardId,
    verificationState: "NEEDS_VERIFICATION",
    verificationInterval: verificationInterval,
    verifiers: [
      {
        type: "user",
        user: {
          status: "ACTIVE",
          email: verificationEmail,
          firstName: verificationFirstName,
          lastName: verificationLastName
        },
        id: verificationEmail,
        dateCreated: utcDate
      }
    ],
    // verifiers: [
    //   {
    //     "type": "user-group",
    //     "userGroup": {
    //       "id": "35725837-184a-4f83-8774-778a8a84f967",
    //       "dateCreated": "2020-07-07T17:33:52.218+0000",
    //       "groupIdentifier": "team",
    //       "expertIdRank": 1,
    //       "numberOfCardsAsVerifier": 0,
    //       "numberOfMembers": 0,
    //       "modifiable": false,
    //       "name": "All Members"
    //     }
    //   }
    // ],
    verificationInitiator: {
      status: "ACTIVE",
      email: "althea.yi@partnerstack.com",
      firstName: "Althea",
      lastName: "Yi"
    },
    verificationReason: "NEW_VERIFIER",
    tags: tags
  };
  try {
    return await axios.put(
      `https://api.getguru.com/api/v1/cards/${cardId}/extended`,
      data,
      headers
    );
  } catch (error) {
    core.setFailed(`Unable to update card: ${error.message}`);
    return;
  }
}

function copyCollectionData(targetDir) {
  if (process.env.GURU_COLLECTION_YAML) {
    console.log(
      `Copying ${process.env.GURU_COLLECTION_YAML} to ${targetDir}/collection.yaml`
    );
    fs.copySync(
      process.env.GURU_COLLECTION_YAML,
      `${targetDir}/collection.yaml`
    );
  } else {
    console.log(`Writing '---' to ${targetDir}/collection.yaml:`);
    fs.writeFileSync(`${targetDir}/collection.yaml`, `--- ~\n`);
  }
}

function copyBoardData(targetDir) {
  let tmpBoardsDir = `${targetDir}/boards`;

  if (process.env.GURU_BOARD_YAML) {
    fs.mkdirSync(tmpBoardsDir);
    let boardConfigs = yaml.parse(
      fs.readFileSync(process.env.GURU_BOARD_YAML, "utf8")
    );
    console.log(boardConfigs);
    let i = 1;

    for (let boardName in boardConfigs) {
      let targetFile = `${tmpBoardsDir}/board${i++}.yaml`;
      console.log(`Writing ${boardName} to ${targetFile}`);
      let boardYaml = yaml.stringify(boardConfigs[boardName]);
      fs.writeFileSync(`${targetFile}`, boardYaml);
    }
  } else if (process.env.GURU_BOARD_DIR) {
    fs.mkdirSync(tmpBoardsDir);
    console.log(`Copying ${process.env.GURU_BOARD_DIR} to ${tmpBoardsDir}`);
    fs.copySync(process.env.GURU_BOARD_DIR, `${tmpBoardsDir}`);
  }
}

function copyBoardGroupData(targetDir) {
  let tmpBoardGroupsDir = `${targetDir}/board-groups`;

  if (process.env.GURU_BOARDGROUP_YAML) {
    fs.mkdirSync(tmpBoardGroupsDir);
    let boardGroupConfigs = yaml.parse(
      fs.readFileSync(process.env.GURU_BOARDGROUP_YAML, "utf8")
    );
    console.log(boardGroupConfigs);
    let i = 1;

    for (let boardGroupName in boardGroupConfigs) {
      let targetFile = `${tmpBoardGroupsDir}/board-group${i++}.yaml`;
      console.log(`Writing ${boardGroupName} to ${targetFile}`);
      let boardGroupYaml = yaml.stringify(boardGroupConfigs[boardGroupName]);
      fs.writeFileSync(`${targetFile}`, boardGroupYaml);
    }
  } else if (process.env.GURU_BOARDGROUP_DIR) {
    fs.mkdirSync(tmpBoardGroupsDir);
    console.log(
      `Copying ${process.env.GURU_BOARDGROUP_DIR} to ${tmpBoardGroupsDir}`
    );
    fs.copySync(process.env.GURU_BOARDGROUP_DIR, `${tmpBoardGroupsDir}`);
  }
}

function copyResources(targetDir) {
  let tmpResourcesDir = `${targetDir}/resources`;

  if (process.env.GURU_RESOURCES_DIR) {
    fs.mkdirSync(tmpResourcesDir);
    console.log(
      `Copying ${process.env.GURU_RESOURCES_DIR} to ${tmpResourcesDir}`
    );
    fs.copySync(process.env.GURU_RESOURCES_DIR, `${tmpResourcesDir}`);
  }
}

function processExternalCollection(auth) {
  let tmpdir = tmp.dirSync();
  console.log("tmpdir: ", tmpdir.name);
  let tmpCardsDir = `${tmpdir.name}/cards`;
  fs.mkdirSync(tmpCardsDir);
  copyCollectionData(tmpdir.name);
  copyBoardData(tmpdir.name);
  copyBoardGroupData(tmpdir.name);
  copyResources(tmpdir.name);

  if (process.env.GURU_CARD_YAML) {
    let cardConfigs = yaml.parse(
      fs.readFileSync(process.env.GURU_CARD_YAML, "utf8")
    );
    console.log(cardConfigs);

    for (let cardFilename in cardConfigs)
      try {
        let tmpfileBase = cardFilename
          .replace(/\.md$/gi, "")
          .replace(/[^a-zA-Z0-9]/gi, "_");

        while (fs.existsSync(`${tmpCardsDir}/${tmpfileBase}.yaml`)) {
          tmpfileBase += `_`;
        }

        console.log(
          `Writing ${cardFilename.replace(
            /\.md$/gi,
            ""
          )} to ${tmpCardsDir}/${tmpfileBase}.yaml`
        );
        fs.copySync(cardFilename, `${tmpCardsDir}/${tmpfileBase}.md`);
        let cardConfig = cardConfigs[cardFilename];

        if (!cardConfig.ExternalId) {
          cardConfig.ExternalId = `${process.env.GITHUB_REPOSITORY}/${cardFilename}`;
        }

        if (!cardConfig.ExternalUrl) {
          cardConfig.ExternalUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/blob/master/${cardFilename}`;
        }

        let cardYaml = yaml.stringify(cardConfig);
        fs.writeFileSync(`${tmpCardsDir}/${tmpfileBase}.yaml`, cardYaml);
      } catch (error) {
        core.setFailed(`Unable to prepare tempfiles: ${error.message}`);
        return;
      }
  } else {
    console.log(`Copying ${process.env.GURU_CARD_DIR} to ${tmpCardsDir}`);
    fs.copySync(process.env.GURU_CARD_DIR, tmpCardsDir);
  }

  apiSendSynchedCollection(
    tmpdir.name,
    auth,
    process.env.GURU_COLLECTION_ID
  ).catch((error) => {
    core.setFailed(`Unable to sync collection: ${error.message}`);
  });
}

function processStandardCollection(auth) {
  if (process.env.GURU_CARD_DIR) {
    core.setFailed(
      "GURU_CARD_DIR is only supported for EXTERNAL collections: https://developer.getguru.com/docs/guru-sync-manual-api"
    );
    return;
  } else {
    let cardConfigs = yaml.parse(
      fs.readFileSync(process.env.GURU_CARD_YAML, "utf8")
    );

    for (let cardFilename in cardConfigs)
      try {
        apiSendStandardCard(
          auth,
          process.env.GURU_COLLECTION_ID,
          cardConfigs[cardFilename].Title,
          cardConfigs[cardFilename].TeamId,
          cardConfigs[cardFilename].TagCategoryName,
          cardConfigs[cardFilename].VerificationInterval,
          cardConfigs[cardFilename].VerificationEmail,
          cardConfigs[cardFilename].VerificationFirstName,
          cardConfigs[cardFilename].VerificationLastName,
          cardFilename
        )
      } catch (error) {
        core.setFailed(
          `Unable to prepare card for creation/update: ${error.message}`
        );
      }
  }
}

try {
  let auth = {
    username: process.env.GURU_USER_EMAIL,
    password: process.env.GURU_USER_TOKEN
  };
  getCollection(auth, process.env.GURU_COLLECTION_ID)
    .then((response) => {
      console.log(
        `Found ${response.data.collectionType} collection at https://app.getguru.com/collections/${response.data.slug} with ${response.data.cards} cards (${response.data.publicCards} publc)`
      );
      let isExternalCollection = response.data.collectionType == `EXTERNAL`;

      if (!(process.env.GURU_CARD_DIR || process.env.GURU_CARD_YAML)) {
        core.setFailed(`Specify either GURU_CARD_DIR or GURU_CARD_YAML`);
        return;
      }

      if (isExternalCollection) {
        processExternalCollection(auth);
      } else {
        processStandardCollection(auth);
      }
    })
    .catch((error) => {
      core.setFailed(`Unable to get collection info: ${error.message}`);
    });
} catch (error) {
  core.setFailed(error.message);
}
