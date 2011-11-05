/**
 * Improves Backbone Model support when nested attributes are used.
 * get() and set() can take paths e.g. 'user.name'
 */
;(function() {

    /**
     * Takes a nested object and returns a shallow object keyed with the path names
     * e.g. { "level1.level2": "value" }
     * 
     * @param  {Object}      Nested object e.g. { level1: { level2: 'value' } }
     * @return {Object}      Shallow object with path names e.g. { 'level1.level2': 'value' }
     */
    function objToPaths(obj) {
        var ret = {};

        for (var key in obj) {
            var val = obj[key];

            if (val.constructor === Object) {
                //Recursion for embedded objects
                var obj2 = objToPaths(val);

                for (var key2 in obj2) {
                    var val2 = obj2[key2];

                    ret[key+'.'+key2] = val2;
                }
            } else {
                ret[key] = val;
            }
        }

        return ret;
    }

    /**
     * @param {Object}  Object to fetch attribute from
     * @param {String}  Object path e.g. 'user.name'
     * @return {Mixed}
     */
    function getNested(obj, path) {
        var fields = path.split(".");
        var result = obj;
        for (var i = 0, n = fields.length; i < n; i++) {
            result = result[fields[i]];
            
            if (typeof result === 'undefined') {
                return result;
            }
        }
        return result;
    }
    
    /**
     * @param {Object}  Object to fetch attribute from
     * @param {String}  Object path e.g. 'user.name'
     * @param {Mixed}   Value to set
     */
    function setNested(obj, path, val) {
        var fields = path.split(".");
        var result = obj;
        for (var i = 0, n = fields.length; i < n; i++) {
            var field = fields[i];
            
            //If the last in the path, set the value
            if (i === n - 1) {
                result[field] = val;
            } else {
                //Create the child object if it doesn't exist
                if (typeof result[field] === 'undefined') {
                    result[field] = {};
                }
                
                //Move onto the next part of the path
                result = result[field];
            }
        }
    }

    var DeepModel = Backbone.Model.extend({
       
        // Override get
        // Supports nested attributes via the syntax 'obj.attr' e.g. 'author.user.name'
        get: function(attr) {
            return getNested(this.attributes, attr);
        },

        // Override set
        // Supports nested attributes via the syntax 'obj.attr' e.g. 'author.user.name'
        set: function(attrs, options) {
            // Extract attributes and options.
            options || (options = {});
            if (!attrs) return this;
            if (attrs.attributes) attrs = attrs.attributes;
            var now = this.attributes, escaped = this._escapedAttributes;

            // Run validation.
            if (!options.silent && this.validate && !this._performValidation(attrs, options)) return false;

            // Check for changes of `id`.
            if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

            // We're about to start triggering change events.
            var alreadyChanging = this._changing;
            this._changing = true;
            
            
            //START CUSTOM CODE
            var self = this;
            
            function performSet(attrs) {
                // Update attributes.
                for (var attr in attrs) {
                    var val = attrs[attr];

                    if (val.constructor === Object) {
                        //Recursion for nested objects
                        performSet(val);
                    } else {
                        if (!_.isEqual(getNested(now, attr), val)) {
                            setNested(now, attr, val);
                            //deleteNested(escaped, attr); //TODO: Create this and use instead of setNested line below?
                            setNested(escaped, attr, undefined);
                            self._changed = true;
                            if (!options.silent) self.trigger('change:' + attr, self, val, options);
                        }
                    }
                }
            }
            
            attrs = objToPaths(attrs);
            
            performSet(attrs)
            
            //END CUSTOM CODE


            // Fire the `"change"` event, if the model has been changed.
            if (!alreadyChanging && !options.silent && this._changed) this.change(options);
            this._changing = false;
            return this;
        }

    });
    
    
    //Exports
    Backbone.DeepModel = DeepModel;
    
})();
