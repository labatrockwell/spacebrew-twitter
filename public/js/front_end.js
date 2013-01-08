var uiPort = uiPort || 3001;

var sb = {};
	sb.server = '127.0.0.1';
	sb.conn = new WebSocket("ws://"+sb.server+":" + uiPort);  

var model = {};
	model.tweets = [];
	model.query = "";


$(window).bind("load", function() {
	setupQuery();	
});

sb.conn.onopen = function() {
	console.log("WebSockets connection opened");
	sb.conn.send("Connection Established");
}

sb.conn.onmessage = function(data) {
    console.log("Got WebSockets message: ", data.data);
    try {
	    var jData = JSON.parse(data.data);	
	    console.log("jData: ", jData);
    	if (jData.user && jData.text && jData.created_at ) {
    		model.tweets.unshift(jData);
    	}
	    for (var i in model.tweets) {
		    console.log("user: " + model.tweets[i].user + "\ntext: " + model.tweets[i].text + "\ncreated: " + model.tweets[i].created_at);
		}
    } catch (e) {
	    console.log("error parsing data as json: " + e);	
    }

    loadTweets();
}

sb.conn.onclose = function() {
    console.log("WebSockets connection closed");
}

sb.conn.onerror = function(e) {
  console.log("onerror ", e);
}

function loadTweets() {
	$("#tweet_container .tweet").remove();        

	for (var i in model.tweets) {
		var $newEle = $("#templates .tweet").clone();
		$newEle.attr( {id: i} );
		$newEle.find(".user").text(model.tweets[i].user);
		$newEle.find(".text").text(model.tweets[i].text);
		$newEle.find(".created_at").text(model.tweets[i].created_at);
		$newEle.appendTo('#tweet_container');
		if (this.debug) console.log("[updateTransformList] created a new list item", $newEle);
	}	
}


function setupQuery() {
	$("#qSubmit").on("click", function() {
		if ($("#qText").val() != "enter query" && $("#qText").val() != "" ) {
			model.query = $("#qText").val();
			var msg = { query: model.query }; 
			sb.conn.send(JSON.stringify(msg));
			$("#query_results h1").text("Forwarding Tweets With:  " + model.query);
			model.tweets = [];
			loadTweets();
		}
	});
}


