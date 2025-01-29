# Get Vault Positions

copy `.env.example` to `.env` and set the `RPC_URL` (you can use a free Alchemy key generated at https://dashboard.alchemy.com/apps)
- `cp .env.example .env`

Install dependencies
- `npm install`

Run the script
- `npm start`

Then the script will start fetching all blocks to calculate the vault positions at the block number:

![](https://i.imgur.com/CZ0Wcjt.png)

When finished it will save the results to `output.json`

![](https://i.imgur.com/1Ba6LbV.png)

![](https://i.imgur.com/JcnOWGy.png)