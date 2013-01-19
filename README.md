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
  
Here is a list of the packages that can be installed via npm. Just run the command above once for each app, switching out `DEPENDENCY_PKG_NAME` with each app's name:  
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
Now you are ready to run the app. Go to app's base directory in the terminal, or other shell, and enter the launch command below with the appropriate arguments.

```
node app.js
```
  
When launching the node app you can specify the port number where the front-end web app will be served. To set the port number append the following parameter to the app launch command  `port=PORT_NUM`. Below is an example of an app launch command where the port number is set to 3009. By default the port is set to 3002.
    
```
node app.js port=3009 
```  
    
##4. Play Time
Open a browser, navigate to the server at the appropriate port number, and set add the spacebrew server address and app name to the query string, as shown below.

[`http://localhost:3009?server=server=sandbox.spacebrew.cc&name=tweets&`](http://localhost:3009?server=server=ec2-184-72-140-184.compute-1.amazonaws.com&name=tweets&) 


When the app is loaded, type in a query and hit submit and watch the tweets come up. Note that the app only loads new tweets every 20 seconds.  
  
Features to Add
===============
* Enable app to support multiple environments in preparation for deployment (dev and deployment)
