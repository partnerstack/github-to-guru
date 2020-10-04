const yaml = require("yaml");
const fs = require(`fs-extra`);
const path = require("path");

let cardConfigs = yaml.parse(
    fs.readFileSync("cards.yaml", "utf8")
);

for (let cardFilename in cardConfigs) {
    fs.appendFileSync(path.resolve(`${cardFilename}`), "\n WHATEVER TEST", { flag: "as" })
}