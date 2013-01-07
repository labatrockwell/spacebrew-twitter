Spacebrew Twitter App
---------------------
An app the forwards tweets to spacebrew. People can submit queries via a text box, and then all new tweets that match the query are forwarded to spacebrew every 30 seconds.

Installing the App  
==================  
  
##1. Install dependencies 
The first step is installing the node modules in the node_modules directory of this project. Most modules can be installed using node's nifty npm utility, though one of them will require a manual install. 
  
To install modules using npm, open up the terminal program and go to the base directory of this project. Then run the following command for each module:   

```
npm install DEPENDENCY_PKG_NAME
```
  
Packages that can be installed via npm:  
* `express`  
* `jade`  
* `nib`  
* `stylus`  
* `ws`  
  
Packages that need to be installed manually:  
* `Temboo` To install this module go to [Temboo website](http://www.temboo.com), sign-up for account, download the node sdk, and copy it into the node_modules directory of this project.  
  
##2. Set-up Temboo Credentials
Next, you need to create temboo_auth.js file with your Temboo credentials and app information. This file is ignored by git because it contains private information that should not be tracked. The temboo_auth.js file needs to follow the format outlined below, which is also available on the temboo_auth_template.js template file. 

```
module.exports = {
    tAuth : {
        user : ADD_TEMBOO_USER_NAME,
        app : ADD_TEMBOO_APP_NAME,
        key : ADD_TEMBOO_APP_KEY
    }
};
```

##3. Run App
Now you are ready to run the app. Go to app's base directory in the terminal, or other shell, and enter the following command:

```
node app.js
```

##4. Play Time
Open a browser and go to [`http://localhost:3000`](http://localhost:3000) to load the app. Then type in a query and hit submit and watch the tweets come up.  
  
Please note that the app only loads new tweets every 30 seconds. Also, the webpage is connect to the node server via websockets on port `3001`, in case you are using this port for something else you may need to change this in the code. Just update the `wssUI.port` variable in the `app.js` file.
  
Features to Add
===============
* Refactor code to clean it up and make it more stable and able to handle multiple clients better
* Block late responses when a new query has been submitted
* Enable app to support multiple environments in preparation for deployment (dev and deployment)
* Clean-up app and re-architect to make it a general web services app using the temboo api

