require('dotenv').config()
const mysql = require('mysql');
const express = require('express');
const bcrypt = require('bcrypt');
const app = express();
app.use(express.json());

// Stvaranje baze
const connection  = mysql.createConnection({
    host: 'localhost',
    user: 'admin',
    password: process.env.DATABASE_PASSWORD,
    database: 'loginsys'
});
 // Spajanje na bazu
connection.connect((err) => {
    if(err) throw err;
    console.log("Connected to database");
})

// Dohvacanje svih usera iz baze
app.get('/users', (req, res) => {
    connection.query('SELECT * FROM users', (err, result) => {
            if (err) throw err;
            res.send(result);
    })
})

// Kreiranje novog usera
app.post('/users/register', async (req, res) => {
    try {
        // Stvara hashiran password, i objekt usera s tim hashiranim passwordom
        const hashedPass = await bcrypt.hash(req.body.pass, 10);
        let user = {
            username: req.body.username,
            pass: hashedPass
        }
        // Ubacuje user objekt u bazu
        connection.query("INSERT INTO users SET ?", user, (err, result) => {
            if (err) throw err
            console.log("Korisnik kreiran")
        })
    } catch (error) {
        console.log(error)
    }
    res.status(100).send("Korisnik kreiran")
})

// Autentikacija korisnika, i login
app.post("/users/login", async (req, res) =>{
    // Promise, salje query za vracanje usera iz baze, i u resolve vraca tog usera
     const fetchUser = new Promise((resolve, reject) => {
         connection.query(`SELECT * FROM users WHERE users.username = "${req.body.username}"`, (err, result) => {
            if (err)throw reject(err)
            const resultJson = JSON.parse(JSON.stringify(result[0]))
            console.log(resultJson)
            resolve(resultJson)
        })
      });
    
    
    fetchUser.then(async user=> {
        // Provjera da li je to taj user, usporedba passworda sa hashiranim passwordom iz baze
        try {
            await bcrypt.compare(req.body.pass, user.pass, (err, result) => {
                console.log(req.body.pass + " USPOREDBA " + user.pass);
                if(err){
                    throw err;
                };
            })
           }
        catch (err) {}
      }).catch(err => {
        console.log(err)
      })
})


app.listen(3000);