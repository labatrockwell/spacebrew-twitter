Updates:
* Create model object when page is requested, and then update object when websocket connection to UI is established
	* Create model object when page is requested
		* Update the clientId variable on the page request handler method
		* Pass clientId variable to front_end js via local object on render call
	* Have front end application send back the clientId