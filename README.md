Spacebrew Webservices App
==================  
An app that forwards tweets and foursquare check-ins to spacebrew. People can define filters via text boxes, and then all content that meets the filter requirements are forwarded to spacebrew at a specific refresh rate.

Installing the App  
---------------------
  
###1. Install dependencies 
The first step is installing the node modules in the node_modules directory of this project. Most modules can be installed using node's nifty npm utility, though one of them will require a manual install. 
  
To install modules using npm, open up the terminal program and go to the base directory of this project. Then run the following command for each module:   

```
npm install DEPENDENCY_PKG_NAME
```
  
Here is a list of the packages that can be installed via npm. Just run the command above once for each app, switching out `DEPENDENCY_PKG_NAME` with each app's name:  
* `express`  
* `jade`  
* `nib`  
* `stylus`  
* `ws`  
* `request`
  
Packages that need to be installed manually:  
* `Temboo` To install this module go to [Temboo website](http://www.temboo.com), sign-up for account, download the node sdk, and copy it into the node_modules directory of this project.  
  
###2. Set-up Temboo Credentials
Next, you need to create temboo_auth.js file with your Temboo credentials and app information. This file is ignored by git because it contains private information that should not be tracked. The temboo_auth.js file needs to follow the format outlined below, which is also available on the temboo_auth_template.js template file. 

```
module.exports = {
    tAuth : {
        user : ADD_TEMBOO_USER_NAME,	// string
        app : ADD_TEMBOO_APP_NAME,		// string
        key : ADD_TEMBOO_APP_KEY		// string
    }
};
```

###3. Set-up the Appropriate Webservice Auth Files
Please note that we have migrate this app to use temboo to handle the OAuth2.0 authentication for twitter and foursquare (that's right the new twitter api requires authentication even for search).  

This means that in order to set-up a local version of this app you will need to configure the appropriate credentials in you temboo account. We'll post more information about how to do this soon. In the meantime you should just read temboo's documentation and look at the code in the twitter and foursquare controller files, which are saved in the controllers directory.

###4. Run App
Now you are ready to run the app. Go to app's base directory in the terminal, or other shell, and enter the launch command below with the appropriate arguments.

```
node app.js
```
  
When launching the node app you can specify the port number where the front-end web app will be served. To set the port number append the following parameter to the app launch command  `port=PORT_NUM`. Below is an example of an app launch command where the port number is set to 3009. By default the port is set to 8002.
    
```
node app.js port=8004 
```  
    
###5. Play Time
Once the app is running, you can access the twitter app at `/twitter` and the foursquare app at `/foursquare`. Therefore, if you are running the server on your local computer using port 3009 then the twitter app would available at `http://localhost:3009/twitter`, while the foursquare app would be available at `http://localhost:3009/foursquare`.

You can configure the app using the following query string options:

* `name`: name of the application that will be registered with spacebrew. 
* `server`: spacebrew server hostname.
* `description`: description of the application that will be registered with spacebrew.
* `refresh`: number of seconds between each time the data is refreshed.

Here is an example URL with all of these query options defined:
```
http://localhost:3009/twitter?server=sandbox.spacebrew.cc&refresh=10&name=tweets in space&description=app that forwards tweets
```
  
Latest Updates
---------------------
* twitter app works with new api the requires authentication
* foursquare app has been migrated to use temboo for OAuth authentication
* buttons enable you to turn forwarding on and off
* tweet querie can be submitted via spacebrew (though forwarding needs to be activated) 
