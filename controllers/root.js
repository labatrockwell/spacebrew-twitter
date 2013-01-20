module.exports = {
    model: {},

    init: function( services ) {
        if (services) this.model.services = services;
        return this;
    },

    /**
     * handleRoot Callback function that handles requests to the base URL
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
     */
    handleRoot: function (req, res) {
      res.write('live services:\n');
      for (var i in this.model.services) {
          res.write('\t/' + this.model.services[i]);
      }
      res.end();
    }
}