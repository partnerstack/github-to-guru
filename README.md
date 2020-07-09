# GitHub to Guru - PStack Version
Updating the Github-to-Guru action with Pstack flair.

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

## TODO LIST
1. Figure out how to set a group of users as the verifier.
2. Figure out if we can make cards for nested files.
3. Create a `createBoard` function.
4. Create an `updateBoard` function.
