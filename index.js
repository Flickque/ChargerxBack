const express = require('express')
const app = express()
const port = 4000
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const passportHttp = require('passport-http');
var Strategy = passportHttp.BasicStrategy;

const saltRounds = 4;

app.use(bodyParser.json());
app.use(cors())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/chargers', (req, res) => {
  db.query('SELECT * FROM chargers').then(results => {
    res.json(results);
  })
})

app.get('/purchases', (req, res) => {
  db.query('SELECT * FROM purchases').then(results => {
    res.json(results);
  })
})

app.get('/hello-protected', passport.authenticate('basic', { session: false }),
  (req, res) => res.send('Hello Protected World!')
);

app.get('/user', passport.authenticate('basic', { session: false }), (req, res) => {

    db.query('SELECT * FROM users WHERE id=?',[req.user.id]).then(results => {
          res.json(results);  
          res.sendStatus(200);          
    })    

});


app.post('/start-charge', passport.authenticate('basic', { session: false }), (req, res) => {


  let id = req.body.id;
  let user_id = req.user.id;
  let time_amount = req.body.time_amount;
  let startTime = req.body.startTime;
  

  db.query('SELECT charger_id, date_start, date_end FROM purchases WHERE purchases.user_id = ? AND active=1',[req.user.id]).then(results => {
          
    if (results.length>0)
    {
        res.sendStatus(404);
    }
    else
    {
      
      db.query('INSERT INTO purchases (user_id,charger_id,date_start,date_end,total_amount,time_amount, time ,charge_amount,payed,active) VALUES(?,?,?,?,?,?,?,?,?,?)', 
          [user_id, req.body.id, startTime, 0, 0, time_amount, 0, 0, false, true  ]).then(results => {
         
         res.sendStatus(200);
         res.json(results)
         
         
      })

    }
  })   
  
});



function totalAmount(amount, price, power, time){
  if (price==0) return 0
  if (price==0.2) return price*amount
  if (price==0.003) return price*power*(time/60)
}

app.post('/stop-charge', passport.authenticate('basic', { session: false }), (req, res) => {

  let id = req.body.id;
  let user_id = req.user.id;
  let endTime = req.body.endTime;

  db.query('SELECT purchases.id, purchases.date_start, purchases.time_amount, chargers.price, chargers.power FROM purchases LEFT JOIN chargers ON purchases.charger_id = chargers.id AND purchases.charger_id=? ORDER BY purchases.active DESC', [id]).then(results => {
      let time = (endTime-results[0].date_start)+2
      let total_amount = totalAmount(results[0].time_amount, results[0].price, results[0].power, time)
      let charge_amount = (time/60)*results[0].power
      let pid = results[0].id
      db.query('UPDATE purchases SET date_end=?,total_amount=?,time=?,charge_amount=?,active=0 WHERE id=? ', [endTime, total_amount, time, charge_amount, pid]).then(results => {
          res.json({time, total_amount, charge_amount, pid, endTime, id, user_id}) 
        res.sendStatus(200);
      })   

          
  })
 
});



app.post('/pay', passport.authenticate('basic', { session: false }), (req, res) => {

  let purchase_id = req.body.id;
  let user_id = req.user.id;

  db.query('SELECT users.money, purchases.total_amount FROM users LEFT OUTER JOIN purchases ON users.id = ? AND purchases.id = ?', [user_id, purchase_id]).then(dbResults => {
    let money = results[0].money - results[0].total_amount
    db.query('UPDATE purchases SET payed=1 WHERE id=? ', [purchase_id]).then(results => {})
    db.query('UPDATE users SET money=? WHERE id = ?', [money, user_id]).then(dbResults => {})
    res.sendStatus(200);
    res.json(results)
    

  })

});



app.get('/chargers-protected',
        passport.authenticate('basic', { session: false }),
        (req, res) => 
        {
        	db.query('SELECT * FROM chargers').then(results => {
          res.sendStatus(200);
			    res.json(results);			    
		    })
        }
);

app.get('/active-chargers',
        passport.authenticate('basic', { session: false }),
        (req, res) => 
        {
          db.query('SELECT charger_id, date_start, date_end FROM purchases WHERE purchases.user_id = ? AND active=1',[req.user.id]).then(results => {
          res.json(results);
          res.sendStatus(200)
        })
        }
);


app.get('/purchases-protected',
        passport.authenticate('basic', { session: false }),
        (req, res) => 
        {
        	let purchases = []
        	var chargers = []
        	db.query('SELECT * FROM purchases LEFT JOIN chargers ON purchases.charger_id = chargers.id').then(results => {
		    	res.json(results)
		    })
		   

		    /*
				let merged = []	
			     purchases.forEach((element, i) => {
				    		         
			     	merged[i] = {
			     		id: element.id,
			     		date_start: element.date_start,	
			    		date_end: element.date_end,			
			    		total_amount: element.total_amount,			
			    		amount: element.amount,	   
			    		charge_amount: element.charge_amount,	   
			    		payed: element.active
			     	}
			    })
		    	res.json(merged)
		    	
			     purchases.forEach((element, i) => 
			    	db.query('SELECT * FROM chargers WHERE id = ?', [element.charger_id] ).then(results => {
			    		merged[i] = results
					   
				    })
		    	);	  
	    	*/
		    
        }
);

passport.use(new Strategy((username, password, cb) => {
  db.query('SELECT id, name, password FROM users WHERE name = ?', [username]).then(dbResults => {

    if(dbResults.length == 0)
    {
      return cb(null, false);
    }

    bcrypt.compare(password, dbResults[0].password).then(bcryptResult => {
      if(bcryptResult == true)
      {
        cb(null, dbResults[0]);
      }
      else
      {
        return cb(null, false);
      }
    })

  }).catch(dbError => cb(err))
}));


/* AUTH */

app.post('/register', (req, res) => {
  console.log(req.body);

  const passwordHash = bcrypt.hashSync(req.body.password, 8);

  users.push({
    id: uuidv4(),
    username: req.body.username,
    password: passwordHash,
    email: req.body.email,
  });

  res.sendStatus(200);
});



app.post('/login', passport.authenticate('basic', { session: false }), (req, res) => {
  console.log(req.user);
  res.sendStatus(200);
});



/* DB init */
Promise.all(
  [
      db.query(`SELECT 1 + 1 AS solution`)
  ]
).then(() => {
  console.log('database initialized');
  app.listen(port, () => {
      console.log(`Example API listening on http://localhost:${port}\n`);
  });
})
.catch(error => console.log(error));