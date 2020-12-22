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

function getH2Content(file, uniqueH2Tags, existingH2TagLines) {
  // take the content and split it off into sub-content based on the H2 tag
  let contentMap = {}
  let arr = file.split(/\r?\n/);
  let h2_regex = /^## \w+/
  arr.forEach((line, idx) => {
    if (h2_regex.test(line)) {
      // if we run into an H2, we want its corresponding uniqueH2Tag
      // then we want to map the subcontent starting from the H2 to the next H2 (or end of file)
      // eg. contentMap = { "10293daf210adg9124": subcontent, "aljd1j312412j3421": subcontent}
    }
  });
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

async function createCard(
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
    return axios.post(
      `https://api.getguru.com/api/v1/facts/extended`,
      cardData,
      headers
    ).then((repsonse) => {
      console.log("Response", response);
    }).catch((error) => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
      }
    })
  } catch (error) {
    core.setFailed(
      `Unable to create card: ${error.message}`
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
        createCard(
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

        createCard(
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

        createCard(
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
          createCard(
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
  var uniqueTagId
  try {
    apiGetAllTagCategories(
      auth,
      teamId
    ).then((response) => {
      console.log("Found a bunch of tag categories...", response.data)

      if (response.data !== undefined) {
        let tagCategoryIndex = getTagCategoryIndexByName(response.data, tagCategoryName)

        if (tagCategoryIndex !== -1) {
          console.log("Found a tag category with the target name", tagCategoryName)
          let tagsInCategory = getTagsInCategory(response.data, tagCategoryIndex)

          let desiredTag = getTagByValue(tagsInCategory, uniqueTagValue)

          if (desiredTag !== undefined) {
            uniqueTagId = desiredTag.id
          }
        }
      }
      console.log("unique tag id found", uniqueTagId)
      return uniqueTagId
    })
  } catch (error) {
    core.setFailed(`Unable to get tag category id: ${error.message}`);
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

  let h2_regex = /^## \w+/
  var linesThatNeedH2Tags = []
  var existingH2TagLines = []
  var uniqueH2Tags = []
  var existingTag
  var line_arr

  // idx - zero-indexed file line number
  // line - content of a given file line number (aka idx)
  arr.forEach((line, idx) => {
    if (line.includes("UUID Guru Tag -**")) {
      line_arr = line.split(" ")
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
    } else if (line.indexOf("**UUID H2 Guru Tag -** ") == 0) {
      console.log("This line is an existing H2 Tag...")
      // add file line number to list
      existingH2TagLines.push(idx)

      // add tag to list of unqiue h2 tags
      line_arr = line.split(" ")
      uniqueH2Tags.push(line_arr[line_arr.length - 1])
      console.log("Exising H2 Tag Lines", existingH2TagLines)
      return true
    } else if (h2_regex.test(line)) {
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

  if (process.env.GURU_CARD_YAML && uniqueTagValue) {
    // 0. Get all tags and get the tag id of the tag whose value is uniqueTagValue and pass it along to `apiSearchCardByTagValueAndCategoryName`
    let uniqueTagId = apiGetTagIdByTagValue(auth, teamId, tagCategoryName, uniqueTagValue)
    console.log("EXISTING UNIQUE TAG VALUE's TAG ID", uniqueTagId)
    // 1. Search for a card by tag value and return its id.
    try {
      apiSearchCardByTagValueAndCategoryName(
        auth,
        process.env.GURU_COLLECTION_ID,
        uniqueTagValue,
        tagCategoryName,
        content
      ).then((response) => {
        // 2a. If card exists, call to update existing card by id (not by tag value).
        if (response.data.length >= 1) {
          let cardId = response.data[0].id
          let cardTags = response.data[0].tags
          try {
            console.log(
              `Found existing card with title ${title} and uniqueTagValue ${uniqueTagValue} `
            );
            console.log("response data", cardTags);
            console.log(
              `Updating card with Id ${cardId} and uniqueTagValue ${uniqueTagValue} `
            );
            apiUpdateStandardCardById(
              auth,
              process.env.GURU_COLLECTION_ID,
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
                console.log(`Unverifying updated card.`);
                let postData = {};
                return axios.post(
                  `https://api.getguru.com/api/v1/cards/${cardId}/unverify`,
                  { postData },
                  headers
                );
              } catch (error) {
                core.setFailed(`Unable to unverify card: ${error.message}`);
              }
            });
          } catch (error) {
            core.setFailed(`Unable to prepare card: ${error.message}`);
          }
        } else {
          // 2b. If card does not exist, call to create a new unique tag and then a new card with said tag.
          console.log("Creating a new unique tag with team id", teamId);

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

                apiCreateTags(headers, teamId, tagData).then((response) => {
                  if (response.status !== 200) {
                    throw `Request to create tags failed: ${response}`
                  }
                  console.log("Going to get or create new Boards and Cards");
                  console.log("TAG RESPONSE", response);
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
                core.setFailed(`Unable to create new tag: ${error.message}`);
              }
            });
          } catch (error) {
            core.setFailed(`Unable to create tag: ${error.message}`);
          }
        }
      });
    } catch (error) {
      core.setFailed(`Unable to find card: ${error.message}`);
    }
  }

  // TODO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // For each unique H2 Tag, create a brand new card.
  // Use only the `content` from the H2 tag up until the next H2 tag
  // (or until it's the end of the file - figure out the OR logic)
  // make a `getH2Content` function to serve this purpose
  // content = getH2Content(content, uniqueH2Tags, existingH2TagLines)
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // Also figure out how to uniquely search for the subcard, whose tag
  // is appearing in the content body of the parent card... which means
  // the search API will return more than one item
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  // if (process.env.GURU_CARD_YAML && uniqueH2Tags) {
  //   for (let i = 0; i < uniqueH2Tags.length; i++) {
  //     let uniqueTagValue = uniqueH2Tags[i]
  //     // 1. Search for a card by tag value and return its id.
  //     try {
  //       apiSearchCardByTagValueAndCategoryName(
  //         auth,
  //         process.env.GURU_COLLECTION_ID,
  //         uniqueTagValue,
  //         tagCategoryName,
  //         content
  //       ).then((response) => {
  //         // 2a. If card exists, call to update existing card by id (not by tag value).
  //         if (response.data.length >= 1) {
  //           let cardId = response.data[0].id
  //           let cardTags = response.data[0].tags
  //           try {
  //             console.log(
  //               `Found existing card for with title ${title} and uniqueTagValue ${uniqueTagValue} `
  //             );
  //             console.log("response data", cardTags);
  //             console.log(
  //               `Updating card for with Id ${cardId} and uniqueTagValue ${uniqueTagValue} `
  //             );
  //             apiUpdateStandardCardById(
  //               auth,
  //               process.env.GURU_COLLECTION_ID,
  //               title,
  //               cardId,
  //               cardTags,
  //               verificationInterval,
  //               verificationEmail,
  //               verificationFirstName,
  //               verificationLastName,
  //               content
  //             ).then((response) => {
  //               console.log(`Updated card`);

  //               try {
  //                 console.log(`Unverifying updated card.`);
  //                 let postData = {};
  //                 return axios.post(
  //                   `https://api.getguru.com/api/v1/cards/${cardId}/unverify`,
  //                   { postData },
  //                   headers
  //                 );
  //               } catch (error) {
  //                 core.setFailed(`Unable to unverify card: ${error.message}`);
  //               }
  //             });
  //           } catch (error) {
  //             core.setFailed(`Unable to prepare card: ${error.message}`);
  //           }
  //         } else {
  //           // 2b. If card does not exist, call to create a new unique tag and then a new card with said tag.
  //           console.log("Creating a new unique tag with team id", teamId);

  //           try {
  //             apiGetAllTagCategories(
  //               auth,
  //               uniqueTagValue,
  //               teamId,
  //               tagCategoryName
  //             ).then((response) => {
  //               try {
  //                 getTagCategoryIdByName(response.data, tagCategoryName).then(
  //                   (tagCategoryId) => {
  //                     console.log("tag category id????", tagCategoryId);
  //                     let tagData = {
  //                       categoryId: tagCategoryId,
  //                       value: uniqueTagValue
  //                     };
  //                     console.log("get tag data", tagData);

  //                     try {
  //                       console.log("DATA", tagData);
  //                       console.log("teamID", teamId);
  //                       console.log("headers", headers);
  //                       return axios.post(
  //                         `https://api.getguru.com/api/v1/teams/${teamId}/tagcategories/tags/`,
  //                         tagData,
  //                         headers
  //                       ).then((response) => {
  //                         console.log("GOing to get or create new Boards and Cards");
  //                         console.log("TAG RESPONSE", response.data);
  //                         let date = new Date();
  //                         let utcDate = date.getUTCDate();
  //                         let cardPaths = splitCardFilename(cardFilename)
  //                         let tags = [response.data]
  //                         console.log(`Retrieved cardFilename paths: ${cardPaths}`)
  //                         try {
  //                           // TODO - parse cardPaths... make calls to make board group/board/board section accordingly
  //                           getOrCreateBoardsAndCards(
  //                             cardPaths,
  //                             headers,
  //                             title,
  //                             content,
  //                             collectionId,
  //                             tags,
  //                             verificationInterval,
  //                             verificationEmail,
  //                             verificationFirstName,
  //                             verificationLastName,
  //                             utcDate
  //                           )
  //                         } catch (error) {
  //                           core.setFailed(`Unable to getorCreateBoardsAndCards: ${error.message}`);
  //                         }
  //                       });
  //                     } catch (error) {
  //                       core.setFailed(`Unable to create tag: ${error.message}`);
  //                     }
  //                   }
  //                 );
  //               } catch (error) {
  //                 core.setFailed(`Unable to create new tag: ${error.message}`);
  //               }
  //             });
  //           } catch (error) {
  //             core.setFailed(`Unable to create tag: ${error.message}`);
  //           }
  //         }
  //       });
  //     } catch (error) {
  //       core.setFailed(`Unable to find card: ${error.message}`);
  //     }
  //   }
  // }
}

function getTagByValue(tags, tagValue) {
  let desiredTag = tags.find(tag => tag.value == tagValue)
  console.log("Found target tag whose value is", tagValue)
  return desiredTag
}

function getTagsInCategory(data, tagCategoryIndex) {
  console.log("Tag cat index", tagCategoryIndex)
  console.log("Data", data)
  let tagsInCategory = data[tagCategoryIndex].tags.map(tag => tag);
  console.log("Here are the tags in this category", tagsInCategory)
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
  console.log(`Getting all tag categories by team id`);

  try {
    return axios.get(
      `https://api.getguru.com/api/v1/teams/${teamId}/tagcategories`,
      {
        auth: auth
      }
    );
  } catch (error) {
    core.setFailed(`Unable to get tag categories by team Id: ${error.message}`);
  }
}

async function apiSearchCardByTagValueAndCategoryName(
  auth,
  collectionId,
  tagValue,
  tagCategoryName
) {
  console.log(
    `Searching for card in ${collectionId} collection with tag: ${tagValue}`
  );

  // TODO - Swap the tagValue with the tagId!!!!!
  try {
    return axios.get(
      `https://api.getguru.com/api/v1/search/query?searchTerms=${tagValue}&queryType=cards`,
      // `https://api.getguru.com/api/v1/search/query?q=tag-${tagId}%20exists`,
      {
        auth: auth
      }
    );
  } catch (error) {
    core.setFailed(
      `Unable to get find card with tagValue ${tagValue} in category ${tagCategoryName}: ${error.message}`
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
  console.log(`Updating card in ${collectionId}: ${title} with ID ${cardId}`);
  let headers = {
    auth: auth,
    "content-type": `application/json`
  };
  console.log("TAGS", tags);
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
  return axios.put(
    `https://api.getguru.com/api/v1/cards/${cardId}/extended`,
    data,
    headers
  );
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
          .then((response) => {
            console.log(`Created or updated card for ${cardFilename}`);
          })
          .catch((error) => {
            core.setFailed(
              `Unable to create or update card for ${cardFilename}: ${error.message}`
            );
          });
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
