/**
 * Improves Backbone Model support when nested attributes are used.
 * get() and set() can take paths e.g. 'user.name'
 */
;(function(Backbone) {

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

            if (val && val.constructor === Object) {
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
        set: function(key, value, options) {
            var attrs, attr;

            if (_.isObject(key) || key == null) {
                attrs = key;
                options = value;
            } else {
                attrs = {};
                attrs[key] = value;
            }


            // Extract attributes and options.
            options || (options = {});
            if (!attrs) return this;
            if (attrs.attributes) attrs = attrs.attributes;
            if (options.unset) for (attr in attrs) attrs[attr] = void 0;
            var now = this.attributes, escaped = this._escapedAttributes;

            // Run validation.
            if (!this._validate(attrs, options)) return false;

            // Check for changes of `id`.
            if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

            // We're about to start triggering change events.
            var alreadyChanging = this._changing;
            this._changing = true;
            
            
            //START CUSTOM CODE
            var self = this;
            
            this._changed = {};
            function performSet(attrs) {
                // Update attributes.
                for (var attr in attrs) {
                    var val = attrs[attr];

                    if (val && val.constructor === Object) {
                        //Recursion for nested objects
                        performSet(val);
                    } else {
                        setNested(now, attr, val);
                        //deleteNested(escaped, attr); //TODO: Create this and use instead of setNested line below?
                        setNested(escaped, attr, undefined);

                        // This needs to be set for things like changedAttributes() to work
                        self._changed[attr] = val;
                        if (!options.silent) self.trigger('change:' + attr, self, val, options);
                    }
                }
            }
            
            attrs = objToPaths(attrs);
            
            performSet(attrs)
            
            //END CUSTOM CODE


            this._changing = false;
            // Fire the `"change"` event, if the model has been changed.
            if (!alreadyChanging && !options.silent && this._changed)
            {
                // the change:attribute events have allready been fired. This will prevent them from being sent again.
                var backupTrigger = this.trigger
                var self = this;
                this.trigger = function(evt){
                    if (evt == 'change')
                    {
                        backupTrigger.apply(self, arguments)
                    }
                }
                this.change(options);
                this.trigger = backupTrigger;
            }
            return this;
        },

        // Override has
        has: function(attr) {
            return getNested(this.attributes, attr) != null;
        },

        // Remove an attribute from the model, firing `"change"` unless you choose
        // to silence it. `unset` is a noop if the attribute doesn't exist.

        unset : function(attr, options) {
          //if (!(attr in this.attributes)) return this;
          // New code to check if attribute exists
          if (getNested(this.attributes, attr) === undefined) return this;
          options || (options = {});

          //var value = this.attributes[attr]; //Why is this needed?

          // Run validation.
          var validObj = {};
          validObj[attr] = void 0;
          if (!this._validate(attrs, options)) return false;

          // changedAttributes needs to know if an attribute has been unset.
          (this._unsetAttributes || (this._unsetAttributes = [])).push(attr);

          // Remove the attribute.

          //Test if path
          var path = attr.split('.')
          if(path.length === 1){
            delete this.attributes[attr];
            delete this._escapedAttributes[attr];
            if (attr == this.idAttribute) delete this.id;
          } else {
            //Get parent
            var deep_property = path[path.length -1];
            var parent = (path.slice(0,(path.length-1))).join('.')
            var parent_value = getNested(this.attributes, parent);
            var escaped_value = getNested(this._escapedAttributes, parent);
            delete parent_value[deep_property];
            delete escaped_value[deep_property];
          }
          this._changed = true;
          if (!options.silent) {
            this.trigger('change:' + attr, this, void 0, options);
            this.change(options);
          }

          return this;
        }

    });
    
    
    //Exports
    Backbone.DeepModel = DeepModel;
    
})(Backbone);
