const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const app = express();
const PORT = 3000;
const thirtyDays = 1000 * 60 * 60 * 24 * 30; // 30 days in milliseconds

app.use(require("express").json())    // <==== parse request body as JSON
      const bodyParser = require('body-parser');
      app.use(bodyParser.urlencoded({ extended: false }));
      app.use(bodyParser.json())
      app.use(require("express-session")({
        secret: require('crypto').randomBytes(16).toString("hex"),
        cookie: { maxAge: thirtyDays },
        resave: true,
        saveUninitialized: true
      }))


// Load environment variables from .env file
dotenv.config();
console.log(process.env.UNAMES);

const unames = process.env.UNAMES.split(',');
const passwords = process.env.PASSWORDS.split(',');

// Serve static files from the "assets" folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));


function isLoggedIn(req,res,next){
        for(let i=0;i<unames.length;i++){
            if(unames[i]==req.session.username && passwords[i]==req.session.password){
                return next();
            }
        }
        res.redirect("/login?error=access");
}


app.post("/pass/validate/",async (req,res)=>{
        let uname= req.body.username;
        let pass = req.body.password;
        for(let i=0;i<data.accounts.length;i++){
            if(data.accounts[i].username==uname && data.accounts[i].password==pass){
                return res.json({data:true})
            }
        }
        return res.json({data:false})
    })

    app.get('/login',  (req, res) => {
      // If this is a login attempt with credentials
      if (req.query.username && req.query.password) {
          // Validate credentials
          let validLogin = false;
          for(let i = 0; i < unames.length; i++) {
              if(unames[i] === req.query.username && passwords[i] === req.query.password) {
                  validLogin = true;
                  break;
              }
          }
          
          if (validLogin) {
              req.session.username = req.query.username;
              req.session.password = req.query.password;
              res.redirect("/panel");
          } else {
              res.redirect("/login?error=invalid");
          }
      } else {
          // Just serving the login page
          res.sendFile(path.join(__dirname, 'static', 'login.html'));
      }
    })
    app.get('/logout',  (req, res) => {
      req.session.username = "";
      req.session.password = "";
      res.redirect("/")
    })
    app.get("/panel",isLoggedIn,(req,res)=>{
        const data = fs.readFileSync(__dirname+"/views/panel.html").toString()
        const auth = req.session.username+"-"+req.session.password
        res.send(data.replace(/(!auth)/g,auth));
    })
app.get('/events', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'events.html'));
});

app.get('/organizing-committee', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'organizing-committee.html'));
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/style2.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style2.css'));
});

app.get('/config.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'config.json'));
});
// Route to serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.get('/school-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'login.html'));
});

app.get('/api/participating-schools', (req, res) => {
    // Return the count of participating schools
    res.json({ count: unames.length });
});

// Catch-all route for undefined paths to serve 404.html
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'static', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

