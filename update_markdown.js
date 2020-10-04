const yaml = require("yaml");
const fs = require(`fs-extra`);
const path = require("path");

if (process.env.GURU_CARD_DIR) {
    core.setFailed(
        "GURU_CARD_DIR is only supported for EXTERNAL collections: https://developer.getguru.com/docs/guru-sync-manual-api"
    );
    return;
} else {
    let cardConfigs = yaml.parse(
        fs.readFileSync(process.env.GURU_CARD_YAML, "utf8")
    );

    for (let cardFilename in cardConfigs) {
        fs.appendFileSync(path.resolve(`${cardFilename}`), "\n WHATEVER TEST", { flag: "as" })
    }
}