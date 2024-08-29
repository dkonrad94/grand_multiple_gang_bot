const mysql = require('mysql');
const chalk = require('chalk');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'discord_bot'
};

let db;
let dbError = null;  // Hibainformációk tárolására szolgáló változó

function handleDisconnect() {
    db = mysql.createConnection(dbConfig);

    db.connect((err) => {
        if (err) {
            console.error(chalk.hex('#FF5733')('Connection error...'), err.code || err.message);
            dbError = err.code || err.message;  // Hibainformációk elmentése
            return;
        }
    });

    db.on('error', (err) => {
        console.error(chalk.hex('#FF5733')('Database error'), err.code || err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log(chalk.hex('#FFC300')('Reconnected to the MySQL server.'));
            handleDisconnect();
        } else {
            dbError = err.code || err.message;  // Hibainformációk elmentése
        }
    });
}

async function initializeDatabase() {
    return new Promise((resolve) => {
        let errorMessage = null;

        const dbInitialConnection = mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });

        dbInitialConnection.connect((err) => {
            if (err) {
                errorMessage = `\nConnection error to the MySQL server: ${err.code || err.message}`;
                dbError = errorMessage;  // Hibainformációk elmentése
                return resolve({ status: chalk.hex('#FF5733')('Error!'), error: errorMessage });
            }

            dbInitialConnection.query('CREATE DATABASE IF NOT EXISTS discord_bot', (err) => {
                if (err) {
                    errorMessage = `\nError occurred while creating the database: ${err.code || err.message}`;
                    dbError = errorMessage;  // Hibainformációk elmentése
                    return resolve({ status: chalk.hex('#FF5733')('Error!'), error: errorMessage });
                }

                dbInitialConnection.end((err) => {
                    if (err) {
                        errorMessage = `\nError occurred while closing the initial connection: ${err.code || err.message}`;
                        dbError = errorMessage;  // Hibainformációk elmentése
                        return resolve({ status: chalk.hex('#FF5733')('Error!'), error: errorMessage });
                    }

                    handleDisconnect();  // Kapcsolat kezelése itt indul el

                    // Tickets tábla létrehozása
                    const createTableQuery = `
                    CREATE TABLE IF NOT EXISTS tickets (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        guild_id VARCHAR(255),
                        support_role VARCHAR(255),
                        support_category_id VARCHAR(255),
                        claimed_by_id VARCHAR(255),
                        claimed_by_name VARCHAR(255),
                        user_by_opened VARCHAR(255),
                        userid_by_opened VARCHAR(255),
                        ticket_channel_id VARCHAR(255),
                        channel_name VARCHAR(255),
                        category_id VARCHAR(255),
                        category_name VARCHAR(255),
                        total_messages INT DEFAULT 0,
                        welcome_message_id VARCHAR(255),
                        ticket_status VARCHAR(50) DEFAULT 'open' 
                    )`;

                    db.query(createTableQuery, (err) => {
                        if (err) {
                            errorMessage = `\nError occurred while creating the tickets table: ${err.code || err.message}`;
                            dbError = errorMessage;  // Hibainformációk elmentése
                            return resolve({ status: chalk.hex('#FF5733')('Error!'), error: errorMessage });
                        }

                        // Ticket reviews tábla létrehozása
                        const createReviewTableQuery = `
                        CREATE TABLE IF NOT EXISTS ticket_reviews (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            guild_id VARCHAR(255),
                            user_by_opened VARCHAR(255),
                            userid_by_opened VARCHAR(255),
                            ticket_channel_id VARCHAR(255),
                            channel_name VARCHAR(255),
                            category_id VARCHAR(255),
                            category_name VARCHAR(255),
                            total_messages INT DEFAULT 0,
                            dm_review_message_id VARCHAR(255),
                            review_already_sent BOOLEAN DEFAULT FALSE,
                            review_message TEXT,
                            review_rating INT DEFAULT 0,
                            claimed_by_id VARCHAR(255),
                            claimed_by_name VARCHAR(255),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        )`;

                        db.query(createReviewTableQuery, (err) => {
                            if (err) {
                                errorMessage = `\nError occurred while creating the ticket_reviews table: ${err.code || err.message}`;
                                dbError = errorMessage;  // Hibainformációk elmentése
                                return resolve({ status: chalk.hex('#FF5733')('Error!'), error: errorMessage });
                            }

                            // Ticket blacklist tábla létrehozása
                            const createBlacklistTableQuery = `
                            CREATE TABLE IF NOT EXISTS ticket_blacklist (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                discord_user_id VARCHAR(255) UNIQUE,
                                discord_user_name VARCHAR(255),
                                discord_display_name VARCHAR(255),
                                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )`;

                            db.query(createBlacklistTableQuery, (err) => {
                                if (err) {
                                    errorMessage = `\nError occurred while creating the ticket_blacklist table: ${err.code || err.message}`;
                                    dbError = errorMessage;  // Hibainformációk elmentése
                                    return resolve({ status: chalk.hex('#FF5733')('Error!'), error: errorMessage });
                                }

                                resolve({ status: chalk.hex('#28B463')('Connected!'), error: null }); // Ha minden sikeres, zöld "Connected!" visszatérítés
                            });
                        });
                    });
                });
            });
        });
    });
}

// Az adatbázis inicializálása és státusz beállítása
(async () => {
    await initializeDatabase();
})();

// Kapcsolat exportálása
module.exports = () => db;

// Státusz és hibainformációk exportálása
module.exports.getDbStatus = () => dbError ? chalk.hex('#FF5733')('Error!') : chalk.hex('#28B463')('Ok!');
module.exports.getDbError = () => dbError;
