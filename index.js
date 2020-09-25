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

async function apiSendStandardCard(
  auth,
  collectionId,
  title,
  tagValue,
  teamId,
  tagCategoryName,
  verificationInterval,
  verificationEmail,
  verificationFirstName,
  verificationLastName,
  content
) {
  console.log(`Creating or Updating card in ${collectionId}: ${title}`);
  let headers = {
    auth: auth,
    "content-type": `application/json`
  }; // 1. Search for a card by tag value and return its id.

  if (process.env.GURU_CARD_YAML) {
    try {
      apiSearchCardByTagValueAndCategoryName(
        auth,
        process.env.GURU_COLLECTION_ID,
        tagValue,
        tagCategoryName,
        content
      ).then((response) => {
        // 2a. If card exists, call to update existing card by id (not by tag value).
        if (response.data.length >= 1) {
          try {
            console.log(
              `Found existing card for with title ${title} and tagValue ${tagValue}`
            );
            console.log("response data", response.data[0].tags);
            console.log(
              `Updating card for with Id ${response.data[0].id} and tagValue ${tagValue}`
            );
            apiUpdateStandardCardById(
              auth,
              process.env.GURU_COLLECTION_ID,
              title,
              response.data[0].id,
              response.data[0].tags,
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
                  `https://api.getguru.com/api/v1/cards/9b8cf219-842f-428a-8afb-00362440bebd/unverify`,
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
              tagValue,
              teamId,
              tagCategoryName
            ).then((response) => {
              try {
                getTagCategoryId(response.data, tagCategoryName).then(
                  (tagCategoryId) => {
                    console.log("tag category id????", tagCategoryId);
                    let tagData = {
                      categoryId: tagCategoryId,
                      value: tagValue
                    };
                    console.log("get tag data", tagData);

                    try {
                      console.log("DATA", tagData);
                      console.log("teamID", teamId);
                      console.log("headers", headers);
                      axios
                        .post(
                          `https://api.getguru.com/api/v1/teams/${teamId}/tagcategories/tags/`,
                          tagData,
                          headers
                        )
                        .then((response) => {
                          console.log("Creating a new card.");
                          console.log("TAG RESPONSE", response.data);
                          let date = new Date();
                          let utcDate = date.getUTCDate();
                          let cardData = {
                            preferredPhrase: title,
                            content: content,
                            htmlContent: false,
                            collection: {
                              id: collectionId
                            },
                            shareStatus: "TEAM",
                            tags: [response.data],
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

                          try {
                            return axios
                              .post(
                                `https://api.getguru.com/api/v1/facts/extended`,
                                cardData,
                                headers
                              )
                              .then((response) => {
                                try {
                                  console.log(
                                    `Unverifying newly created card.`
                                  );
                                  let postData = {};
                                  return axios.post(
                                    `https://api.getguru.com/api/v1/cards/9b8cf219-842f-428a-8afb-00362440bebd/unverify`,
                                    postData,
                                    headers
                                  );
                                } catch (error) {
                                  core.setFailed(
                                    `Unable to unverify card: ${error.message}`
                                  );
                                }
                              });
                          } catch (error) {
                            core.setFailed(
                              `Unable to create card: ${error.message}`
                            );
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
  console.log(`Getting Tag Category Id`);

  for (i = 0; i < data.length; i++) {
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
  id,
  tags,
  verificationInterval,
  verificationEmail,
  verificationFirstName,
  verificationLastName,
  content
) {
  console.log(`Updating card in ${collectionId}: ${title} with ID ${id}`);
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
    id: id,
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
    `https://api.getguru.com/api/v1/cards/${id}/extended`,
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
          cardConfigs[cardFilename].UniqueTagValue,
          cardConfigs[cardFilename].TeamId,
          cardConfigs[cardFilename].TagCategoryName,
          cardConfigs[cardFilename].VerificationInterval,
          cardConfigs[cardFilename].VerificationEmail,
          cardConfigs[cardFilename].VerificationFirstName,
          cardConfigs[cardFilename].VerificationLastName,
          fs.readFileSync(path.resolve(`${cardFilename}`), "utf8")
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
