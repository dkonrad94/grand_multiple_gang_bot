const fs = require("fs");
const path = require("path");

module.exports = (client, Discord) => {
    let totalCommandFiles = 0;

    fs.readdirSync("./commands/").forEach((dir) => {
        const commandFiles = fs
            .readdirSync(path.join("./commands", dir))
            .filter((file) => file.endsWith(".js"));

        totalCommandFiles += commandFiles.length;

        for (const file of commandFiles) {
            const command = require(`../commands/${dir}/${file}`);

            if (command.data) {
                client.commands.set(command.data.name, command);
                global.client.commandArray.push(command.data.toJSON());
            } else if (command.name) {
                client.commands.set(command.name, command);
            } else {
                continue;
            }
        }
    });

    client.loadStatus.commandsLoaded = true;
    return totalCommandFiles;
};

