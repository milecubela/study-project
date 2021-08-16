require('dotenv').config()
const mysql = require('mysql');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
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
    if(err) throw err
    console.log("Connected to database")
})


// Dohvacanje svih usera iz baze
app.get('/users', authenticateToken, (req, res) => {
    // Provjera autentikacije, vrati samo usera koji je logiran ?
    connection.query(`SELECT * FROM users WHERE users.username = "${req.user.name}"`, (err, result) =>{
        if(err) throw err;
        res.send(result)
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
        connection.query("INSERT INTO users SET ?", user, (err) => {
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
            //console.log(resultJson)
            resolve(resultJson)
        })
      });
    
    
    fetchUser.then(async user=> {
        // Provjera da li je to taj user, usporedba passworda sa hashiranim passwordom iz baze
        try {
            if(!await bcrypt.compare(req.body.pass, user.pass)) {
                console.log("Pogresan password")
            } else {
                //Dobar user, autorizacija --
                console.log("Tocan password")
                const authUser = {name: user.username}
                const accessToken = generateAccessToken(authUser)
                const refreshToken = generateRefreshToken(authUser)

                connection.query(`INSERT INTO refreshTokens (token) VALUES("${refreshToken}")`, (err) => {
                    if(err) throw(err)
                    console.log("Refresh token spremljen u bazu")
                })
                res.json({ accessToken: accessToken})

            }
        }
       catch (err) {}
      }).catch(err => {
        console.log(err)
      })
})

app.post('/refreshtoken', (req, res) => {
    const refreshToken = req.body.token
    if(refreshToken == null) return res.sendStatus(401)
    // Provjera ima li token u bazi refresh tokena
    connection.query(`SELECT token from refreshTokens WHERE token = "${refreshToken}"`, (err, result) => {
        if(err) throw(err)
        const resultJson = JSON.parse(JSON.stringify(result[0])).token
        if(!resultJson == refreshToken) return res.sendStatus(403)
    })

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if(err) return res.sendStatus(403)
        const accessToken = generateAccessToken({name: user.name})
        res.json({ accessToken: accessToken})
    })

})

// Middleware za usporedbu tokena
function authenticateToken(req, res, next){
    // Dohvacanje tokena iz headera, pa slanje na usporedbu
    const authHeader = req.headers['authorization']
    // "key value", odabire value
    // Return null, ili ako ima value splitaj ?
    const token = authHeader && authHeader.split(' ')[1]
    if(!token) return res.sendStatus(401)

    // Usporedba tokena, ako su dobri sprema vrijednost u usera
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if(err) return res.sendStatus(403)
        req.user = user
        next()
    })
}

function generateAccessToken(user){
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10s'})
}

function generateRefreshToken(user){
    return jwt.sign(user, process.env.REFRESH_TOKEN_SECRET)
}

app.listen(3000);