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
    console.log(`Making the card create request to Guru  now with ${cardData}`)
    return axios.post(
      `https://api.getguru.com/api/v1/facts/extended`,
      cardData,
      headers
    ).then((repsonse) => {
      console.log("Response", response);
      console.log("Response data", response.data.json)
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
  // 1. Search for a card by tag value and return its id.
  let file = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
  let arr = file.split(/\r?\n/);
  var existingTag
  arr.forEach((line, idx) => {
    if (line.includes("Guru tag - ")) {
      let line_arr = line.split(" ")
      existingTag = line_arr[line_arr.length - 1]
      return true
    } else {
      return false
    }
  });

  let uniqueTagValue
  let content
  if (!existingTag) {
    console.log(`${cardFilename} has no existingTag.Generating... `)
    uniqueTagValue = uuidv4()
    let uniqueTagValueToWrite = `\nGuru tag - ${uniqueTagValue}`;

    fs.appendFileSync(path.resolve(`${cardFilename}`), uniqueTagValueToWrite, { flag: "as" })
    file = fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
    console.log(`Appended a unique tag to ${cardFilename}: ${uniqueTagValueToWrite}`);
    content = file

  } else {
    console.log(`${cardFilename} has an existingTag: `, existingTag)
    uniqueTagValue = existingTag
    content = file
  }

  if (process.env.GURU_CARD_YAML) {
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
              `Found existing card for with title ${title} and uniqueTagValue ${uniqueTagValue} `
            );
            console.log("response data", cardTags);
            console.log(
              `Updating card for with Id ${cardId} and uniqueTagValue ${uniqueTagValue} `
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
            apiCreateTagByCategoryId(
              auth,
              uniqueTagValue,
              teamId,
              tagCategoryName
            ).then((response) => {
              try {
                getTagCategoryId(response.data, tagCategoryName).then(
                  (tagCategoryId) => {
                    console.log("tag category id????", tagCategoryId);
                    let tagData = {
                      categoryId: tagCategoryId,
                      value: uniqueTagValue
                    };
                    console.log("get tag data", tagData);

                    try {
                      console.log("DATA", tagData);
                      console.log("teamID", teamId);
                      console.log("headers", headers);
                      return axios.post(
                        `https://api.getguru.com/api/v1/teams/${teamId}/tagcategories/tags/`,
                        tagData,
                        headers
                      ).then((response) => {
                        console.log("GOing to get or create new Boards and Cards");
                        console.log("TAG RESPONSE", response.data);
                        let date = new Date();
                        let utcDate = date.getUTCDate();
                        let cardPaths = splitCardFilename(cardFilename)
                        let tags = response.data
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
                      core.setFailed(`Unable to create tag: ${error.message}`);
                    }
                  }
                );
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
}

async function getTagCategoryId(data, tagCategoryName) {
  console.log(`Getting Tag Category Id by Category Name`, tagCategoryName);

  for (let i = 0; i < data.length; i++) {
    if (data[i].name === tagCategoryName) {
      return data[i].id;
    }
  }
}

async function apiCreateTagByCategoryId(auth, teamId) {
  console.log(`Creating tag by CategoryId`);

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

  try {
    return axios.get(
      `https://api.getguru.com/api/v1/search/query?searchTerms=${tagValue}&queryType=cards`,
      {
        auth: auth
      }
    );
  } catch (_unused) {
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
