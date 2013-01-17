var app = {};
	app.view = {};

$(window).bind("load", function() {
	// setupQuery();
	// sbConnect();
	app.view = new View.main();
	app.control = new Control.main(app.view, model);

});

