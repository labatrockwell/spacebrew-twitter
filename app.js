// declare all app variables
var express = require('express')
	, stylus = require('stylus')
	, nib = require('nib')
	, appList = ['twitter', 'foursquare']
	, tembooAuth = require("./auth/auth_temboo").tAuth
	, tsession = require("temboo/core/temboosession")
	, session = new tsession.TembooSession(tembooAuth.user, tembooAuth.app, tembooAuth.key)

	// root app handlers
	, rootApp = require('./controllers/root').init(appList)
	, handleRoot = rootApp.handleRoot.bind(rootApp)

	// twitter app handlers
	, twitterApp = require('./controllers/twitter_control').init( {"session": session} )
	, handleTwitterApp = twitterApp.handleAppRequest.bind(twitterApp)
	, handleTwitterAuth = twitterApp.handleOAuthRequest.bind(twitterApp)
	, handleTwitterQuery = twitterApp.handleQueryRequest.bind(twitterApp)

	// twitter app handlers
	, twitterUpdateApp = require('./controllers/twitter_update_control').init( {"session": session} )
	, handleTwitterUpdateApp = twitterUpdateApp.handleAppRequest.bind(twitterUpdateApp)
	, handleTwitterUpdateAuth = twitterUpdateApp.handleOAuthRequest.bind(twitterUpdateApp)
	, handleTwitterUpdate = twitterUpdateApp.handleStatusUpdate.bind(twitterUpdateApp)

	// foursquare app handlers
	, foursquareApp = require('./controllers/foursquare_control').init( {"session": session} )
	, handleFoursquareApp = foursquareApp.handleAppRequest.bind(foursquareApp)
	, handleFoursquareAuth = foursquareApp.handleOAuthRequest.bind(foursquareApp)
	, handleFoursquareQuery = foursquareApp.handleQueryRequest.bind(foursquareApp)

	, model = model || { httpPort: 8002 }

	// create application
	, app = express()       
	;   // close 'var' statement

// process the arguments passed into app via launch command in terminal
process.argv.forEach(readArgv); 

// set the view location and template type
app.set('views', __dirname + '/views')          // set location of view directory
app.set('view engine', 'jade')                  // set view engine to jade
app.set('view options', { pretty: true })       // turn on "pretty" output view options for jade

// set middleware for processing requests
app.use(express.logger('dev'))                                                          // log requests when first received
app.use(stylus.middleware( { src: __dirname + '/public', compile: compileStylus } ))    // set middleware to use stylus
app.use(express.static(__dirname + '/public'))                                          // serve files in public directory

// set application routes for twitter app
app.get('/', handleRoot);

	// twitter app routes
	app.get('/twitter', handleTwitterApp);
	app.get('/twitter/auth', handleTwitterAuth);
	app.get('/twitter/search', handleTwitterQuery);
	app.get('/twitter/query', handleTwitterQuery);

	// twitter update app routes
	app.get('/tweet', handleTwitterUpdateApp);
	app.get('/tweet/auth', handleTwitterUpdateAuth);
	app.get('/tweet/update', handleTwitterUpdate);

	// twitter foursquare routes
	app.get('/foursquare', handleFoursquareApp);
	app.get('/foursquare/auth', handleFoursquareAuth);
	app.get('/foursquare/search', handleFoursquareQuery);
	app.get('/foursquare/query', handleFoursquareQuery);

app.listen(model.httpPort)    


/**
 * compileStylus Compiles the stylus library to use nib. These are the libraries that handle the stylesheet
 *     stylus files (ending in .styl)
 * @param  {unknown} str  TBD
 * @param  {unknown} path TBD
 */
function compileStylus(str, path) {
  return stylus(str)
    .set('filename', path)
    .use(nib())
}

/**
 * readArgv Function that is called to check each argument that was passed via command along with app launch 
 *          command. Currently, method only checks for a port identifier.  
 * @param  {String} val     Value stored in the current argument 
 * @param  {Integer} index  Index of the current argument
 * @param  {Array} array    Array containing other command line arguments
 */
function readArgv(val, index, array) {
    // check if port number was passed as argument
    var regMatch = val.match(/(\w+)=(\d+)/)
    if (regMatch) {
        if (regMatch[1] == "port") {
            model.httpPort = regMatch[2];   
            console.log("APP http port number set: " + model.httpPort);
        }         
    }
}