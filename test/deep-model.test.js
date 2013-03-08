module("DeepModel");

/*
bugs:
* operations that fail validation should not trigger or modify, but they do
* change events on nested arrays don't fire. Example:
    calling doc.set({'addresses[0].city': 'New York'})  doesn't fire change:addresses or change:addresses[0]
* add events on nested arrays don't fire. Example:
    calling doc.set({ 'addresses[2]': { city: 'Seattle', state: 'WA' } })  doesn't fire add:addresses or change:addresses
* calling unset doesn't fire events. Example:
    doc.unset('addresses[1]') doesn't fire remove:addresses or change:addresses
    
behaviors that break backbone-nested behavior:
* no longer accepts attrPath as 1st arg example: model.set(['first', 'name'])
* different syntax for wildcard events example: doc.set('name.first', 'Bob') won't fire a change:name but it will fire change:name.*
* I think there's a bug in deepmodel's set implementation causing duplicate events
  to trigger. Example:
    doc.set({'name.middle': {
      initial: 'F',
      full: 'Frankenfurter'
    }});

    This causes the following change events to fire:
        name.middle.initial
        name.middle.*
        name.*
        name.middle.full
        name.middle.*
        name.*
        name.* 

  I think we can probably solve this by delaying change triggers until the end of 
  the set operation, similar to how @afeld accomplishes this in backbone-nested
*/

function create() {
    var model = new Backbone.DeepModel({
        id: 123,
        user: {
            type: 'Spy',
            name: {
                first: 'Sterling',
                last: 'Archer'
            }
        }
    });

    return model;
}

function create2() {
    var model = new Backbone.DeepModel({
        gender: 'M',
        name: {
          first: 'Aidan',
          middle: {
            initial: 'L',
            full: 'Lee'
          },
          last: 'Feldman'
        },
        addresses: [
          {
            city: 'Brooklyn',
            state: 'NY'
          },
          {
            city: 'Oak Park',
            state: 'IL'
          }
        ]
    });

    return model;
}

test("get: Gets nested attribute values", function() {
    var model = create();

    deepEqual(model.get('id'), 123);

    deepEqual(model.get('user'), {
        type: 'Spy',
        name: {
            first: 'Sterling',
            last: 'Archer'
        }
    });

    deepEqual(model.get('user.type'), 'Spy');

    deepEqual(model.get('user.name'), {
        first: 'Sterling',
        last: 'Archer'
    });

    deepEqual(model.get('user.name.first'), 'Sterling');
});


test("get: Gets nested attribute values from arrays", function() {
    var model = new Backbone.DeepModel({
        spies: [
            { name: 'Sterling' },
            { name: 'Lana' }
        ]
    });

    deepEqual(model.get('spies.0.name'), 'Sterling');

    deepEqual(model.get('spies.1.name'), 'Lana');
});


test("get: Gets attributes if empty objects", function() {
    var model = new Backbone.DeepModel({
        foo: {},
        bar: []
    });

    deepEqual(model.get('foo'), {});
    deepEqual(model.get('bar'), []);
});


test("set: Sets nested values given a path", function() {
    var model = create();

    model.set({ id: 456 });

    equal(model.attributes.id, 456);


    model.set({
        'user.name.first': 'Lana',
        'user.name.last':  'Kang'
    });

    equal(model.attributes.user.name.first, 'Lana');
    equal(model.attributes.user.name.last, 'Kang');


    model.set({
        'user.type': 'Agent'
    });

    equal(model.attributes.user.type, 'Agent');


    model.set({
        'user.name': {
            first: 'Cheryl',
            last: 'Tunt'
        }
    });

    equal(model.attributes.user.name.first, 'Cheryl');
    equal(model.attributes.user.name.last, 'Tunt');


    model.set({
        user: {
            type: 'Secretary',
            name: {
                first: 'Cheryl',
                last: 'Tunt'
            }
        }
    });

    deepEqual(model.attributes.user, {
        type: 'Secretary',
        name: {
            first: 'Cheryl',
            last: 'Tunt'
        }
    });
});


test('set: Sets a single value - not nested', function() {
    var model = create();

    model.set('id', 456);

    equal(model.attributes.id, 456);
});


test('set: Sets a single value - nested', function() {
   var model = create();

   model.set('user.type', 'Admin');
   model.set('user.name.first', 'Foo');

   equal(model.attributes.user.type, 'Admin');
   equal(model.attributes.user.name.first, 'Foo');
});

test('set: Sets a single value inside null to create an object', function() {
   var model = create();
   
   model.set('user', null);
   model.set('user.type', 'Admin');
   
   equal(model.attributes.user.type, 'Admin');
});

test('set: Sets a single value inside null to create an object when given an object', function() {
   var model = create();
   
   model.set('user', null);
   model.set({user: {type: 'Admin'}});
   
   equal(model.attributes.user.type, 'Admin');
});

test("set: Sets values when given an object", function() {
    var model = create();

    var newValues = {
        id: 456,
        user: {
            type: 'Agent',
            name: {
                first: 'Lana',
                last: 'Kang'
            }
        }
    };

    model.set(newValues);

    deepEqual(model.attributes, newValues);
});

test('set: Can set an object in place of a child non-object value', function() {
    var model = new Backbone.DeepModel({
        id: 123,
        name: ''
    });

    var newName = {
        first: 'Burt',
        last: 'Reynolds'
    };

    model.set('name', newName);

    deepEqual(model.attributes.id, 123);
    deepEqual(model.attributes.name, newName);
});


test("set: Triggers model change:[attribute] events", function() {
    (function() {
        var model = create();

        var triggered = false;

        model.bind('change:id', function(model, val) {
            equal(val, 456);

            triggered = true;
        });

        model.set({ id: 456 });

        //Check callbacks ran
        ok(triggered);
    })();


    (function() {
        var model = create();

        var triggered1 = false,
            triggered2 = false;

        model.on('change:user.name.first', function(model, val) {
            equal(val, 'Lana');

            triggered1 = true;
        });

        model.bind('change:user.name.last', function(model, val) {
            equal(val, 'Kang');

            triggered2 = true;
        });

        model.set({
            'user.name.first': 'Lana',
            'user.name.last':  'Kang'
        });

        //Check callbacks ran
        ok(triggered1);
        ok(triggered2);
    })();


    //Check only expected change events are running
    (function() {
        var model = create();

        var triggeredEvents = [];

        model.bind('all', function(changedAttr, model, val) {
            triggeredEvents.push(changedAttr);
        });

        model.set({
            'id': 456,
            'user.name.first': 'Lana'
        });

        //Check callbacks ran
        deepEqual(triggeredEvents, [
            'change:id',
            'change:user.name.first',
            'change:user.name.*',
            'change:user.*',
            'change'
        ]);
    })();
});

test("set: Correct values passed to wildcard event handlers", function() {
    var model = create();

    var triggered1 = false,
        triggered2 = false,
        triggered3 = false;

    model.on('change:user.name.first', function(model, val) {
        equal(val, 'Lana');

        triggered1 = true;
    });

    model.bind('change:user.name.*', function(model, val) {
        deepEqual(val, { first: 'Lana', last: 'Archer' } );

        triggered2 = true;
    });

    model.bind('change:user.*', function(model, val) {
        deepEqual(val, { name: { first: 'Lana', last: 'Archer' }, type: 'Spy' });

        triggered3 = true;
    });

    model.set({
        'user.name.first': 'Lana'
    });

    //Check callbacks ran
    ok(triggered1);
    ok(triggered2);
    ok(triggered3);
});

test("set: Don't convert Date objects to strings", function() {
    var model = create();

    model.set({ date: new Date });

    ok(_.isDate(model.attributes.date));
});

test("set: Don't delete property when setting it twice with the same value", function() {
    var model = new Backbone.DeepModel();
    model.set('route', {});

    model.set('route.pathName', '/some/route/path');
    equal(model.get('route.pathName'), '/some/route/path');

    model.set('route.pathName', '/some/route/path');
    equal(model.get('route.pathName'), '/some/route/path');
});

test("set: options are passed to the change:[attribute] callback", function() {
    (function() {
        var model = create();

        var triggered = false;

        model.bind('change:id', function(model, val, options) {
            equal(val, 456);

            equal(options.owner, 'Jane Doe');
            triggered = true;
        });

        model.set({ id: 456 }, {owner: 'Jane Doe'});

        //Check callbacks ran
        ok(triggered);
    })();

    (function() {
        var model = create();

        var triggered1 = false,
            triggered2 = false;

        model.on('change:user.name.first', function(model, val, options) {
            equal(val, 'Lana');

            equal(options.changeid, 871);
            triggered1 = true;
        });

        model.bind('change:user.name.last', function(model, val, options) {
            equal(val, 'Kang');

            equal(options.changeid, 872);
            triggered2 = true;
        });

        model.set({'user.name.first': 'Lana' }, {changeid: 871});
        model.set({user: { name: { last: 'Kang' } } }, {changeid: 872});

        //Check callbacks ran
        ok(triggered1);
        ok(triggered2);
    })();
});

test("has: Check if model has root key", function(){
	var model = create();

	equal(model.has('user'), true);
});

test("has: Check if model has deep key", function(){
	var model = create();

	equal(model.has('user.name.last'), true);
});

test("has: Don't find nonexistent key", function(){
	var model = create();

	equal(model.has('user.turtleneck'), false);
});

test("unset: Unset a root key", function(){
    var model = create();

    model.unset('user');

    equal(model.get('user'), undefined);

    deepEqual(model.toJSON(), {
        id: 123
    });
});

test("unset: Unset a deep key", function(){
    var model = create();

    model.unset('user.type');

    deepEqual(model.get('user'), {
            name: {
                first: 'Sterling',
                last: 'Archer'
            }
        });

    deepEqual(model.toJSON(), {
        id: 123,
        user: {
            name: {
                first: 'Sterling',
                last: 'Archer'
            }
        }
    });

});

test("unset: Unset a deeper key", function(){
    var model = create();

    model.unset('user.name.last');

    deepEqual(model.get('user'), {
            type: 'Spy',
            name: {
                first: 'Sterling'
            }
        });

    deepEqual(model.toJSON(), {
        id: 123,
        user: {
            type: 'Spy',
            name: {
                first: 'Sterling'
            }
        }
    });

});

test("unset: Triggers model change:[attribute] events", function() {
    (function() {
        var model = create();

        var triggered = false;

        model.bind('change:id', function(model, val) {
            equal(val, void 0);
            triggered = true;
        });

        model.unset('id');

        //Check callbacks ran
        ok(triggered);
    })();


    (function() {
        var model = create();

        var triggered1 = false;

        model.bind('change:user.name.first', function(model, val) {
            equal(val, void 0);

            triggered1 = true;
        });

        model.unset('user.name.first');

        //Check callbacks ran
        ok(triggered1);
    })();


    //Check only expected change events are running
    (function() {
        var model = create();

        var triggeredEvents = [];

        model.bind('all', function(changedAttr, model, val) {
            triggeredEvents.push(changedAttr);
        });

        model.unset('id');
        model.unset('user.name.first');

        //Check callbacks ran
        deepEqual(triggeredEvents, [
            'change:id',
            'change',
            'change:user.name.first',
            'change:user.name.*',
            'change:user.*',
            'change'
        ]);
    })();
});


test('hasChanged(): matches Model behaviour - when not changed', function() {
    var model = new Backbone.Model({ foo: 'bar' });
    
    var deepModel = new Backbone.DeepModel({
        foo: 'bar',
        user: {
            first: 'John',
            last: 'Smith'
        }
    });

    //Should match default Model behavior on top level
    deepEqual(model.hasChanged(), false);
    deepEqual(deepModel.hasChanged(), false);
});


test('hasChanged(): matches Model behaviour - when changed', function() {
    var model = new Backbone.Model({ foo: 'bar' });
    
    var deepModel = new Backbone.DeepModel({
        foo: 'bar',
        user: {
            first: 'John',
            last: 'Smith'
        }
    });

    model.set('foo', 'baz');
    deepModel.set('foo', 'baz');

    //Should match default Model behavior on top level
    deepEqual(model.hasChanged(), true);
    deepEqual(deepModel.hasChanged(), true);
});

test('hasChanged(attr): matches Model behaviour - when not changed', function() {
    var model = new Backbone.Model({ foo: 'bar' });
    
    var deepModel = new Backbone.DeepModel({
        foo: 'bar',
        user: {
            first: 'John',
            last: 'Smith'
        }
    });

    //Should match default Model behavior on top level
    deepEqual(model.hasChanged('foo'), false);
    deepEqual(deepModel.hasChanged('foo'), false);

    //On nested
    deepEqual(deepModel.hasChanged('user.first'), false);
});


test('hasChanged(attr): matches Model behaviour - when changed', function() {
    var model = new Backbone.Model({ foo: 'bar' });
    
    var deepModel = new Backbone.DeepModel({
        foo: 'bar',
        user: {
            first: 'John',
            last: 'Smith'
        }
    });

    //Should match default Model behavior on top level
    model.set('foo', 'baz');
    deepModel.set('foo', 'baz');

    deepEqual(model.hasChanged('foo'), true);
    deepEqual(deepModel.hasChanged('foo'), true);

    //On nested
    deepModel.set('user.first', 'Frank');

    deepEqual(deepModel.hasChanged('user.first'), true);
});



test('changedAttributes(): returns changed attributes', function() {
    var model = create();

    model.set('user.name.first', 'Lana', {silent: true});

    var changed = model.changedAttributes();

    var expected = {
        'user.name.first': 'Lana'
    }

    deepEqual(changed, expected);
});


test('changedAttributes(): returns changed attributes compared to given object', function() {
    var model = create();

    var diff = {
        id: 789,
        'user.name.last': 'Kang'
    }

    var changed = model.changedAttributes(diff);

    var expected = {
        id: 789,
        'user.name.last': 'Kang'
    }

    deepEqual(changed, expected);
});


test('changedAttributes(): behaves as Model for top level properties', function() {
    var model = new Backbone.Model({foo:1, bar:1}),
        deepModel = new Backbone.DeepModel({foo:1, bar:1});

    deepEqual(deepModel.changedAttributes(), model.changedAttributes());

    model.set({foo:2});
    deepModel.set({foo:2});

    deepEqual(model.changedAttributes(), { foo: 2 });
    deepEqual(deepModel.changedAttributes(), { foo: 2 });
});

test('changedAttributes(): with deep properties', function() {
    var deepModel = new Backbone.DeepModel({
        foo: { baz: 1 }, 
        bar: { baz: 1 }
    });

    deepEqual(deepModel.changedAttributes(), false);

    deepModel.set({'foo.bar':2});
    deepEqual(deepModel.changedAttributes(), {'foo.bar':2});
});


test('changedAttributes(diff): behaves as Model for top level properties', function() {
    var model = new Backbone.Model({foo:1, bar:1}),
        deepModel = new Backbone.DeepModel({foo:1, bar:1});

    var diff = { foo: 2 };

    deepEqual(deepModel.changedAttributes(diff), model.changedAttributes(diff));
    deepEqual(deepModel.changedAttributes(diff), { foo: 2 });

    model.set({foo:2});
    deepModel.set({foo:2});
    deepEqual(deepModel.changedAttributes(diff), model.changedAttributes(diff));
    deepEqual(deepModel.changedAttributes(diff), false);
});

test('changedAttributes(diff): with deep properties', function() {
    var deepModel = new Backbone.DeepModel({
        foo: { baz: 1 }, 
        bar: { baz: 1 }
    });

    var diff = { 'foo.baz': 2 };

    deepEqual(deepModel.changedAttributes(diff), { 'foo.baz': 2 });

    deepModel.set({'foo.baz': 2});
    deepEqual(deepModel.changedAttributes(diff), false);
});


test('hasChanged(): behaves as Model for top level attributes', function() {
    var model = new Backbone.Model({test:1}),
        deepModel = new Backbone.DeepModel({test:1});

    equal(deepModel.hasChanged(), model.hasChanged());

    //With silent
    model.set({test:2});
    deepModel.set({test:2});

    deepEqual(model.hasChanged(), true);
    deepEqual(deepModel.hasChanged(), true);
});


test('hasChanged(): with deep attributes', function() {
    var deepModel = new Backbone.DeepModel({
        foo: { bar: 1 }
    });

    equal(deepModel.hasChanged(), false);

    deepModel.set({'foo.bar':2});
    equal(deepModel.hasChanged(), true);
});


test('hasChanged(attr): behaves as Model for top level attributes', function() {
    var model = new Backbone.Model({test:1}),
        deepModel = new Backbone.DeepModel({test:1});

    equal(deepModel.hasChanged('test'), model.hasChanged('test'));

    model.set({test:2});
    deepModel.set({test:2});

    deepEqual(model.hasChanged('test'), true);
    deepEqual(deepModel.hasChanged('test'), true);
});


test('hasChanged(attr): with deep attributes', function() {
    var deepModel = new Backbone.DeepModel({
        foo: { bar: 1 }
    });

    equal(deepModel.hasChanged('foo.bar'), false);

    deepModel.set({'foo.bar':2});
    equal(deepModel.hasChanged('foo.bar'), true);
});


test("defaults: with deep attributes", function() {
    var DefaultsModel = Backbone.DeepModel.extend({
        defaults: {
            details: {
                name: {
                    last: 'Smith',
                    initial: 'J'
                }
            }
        }
    });

    var model = new DefaultsModel({
        details: { 
            name: {
                first: 'John',
                initial: 'Z'
            }
        }
    });

    equal(model.get('details.name.first'), 'John');
    equal(model.get('details.name.last'), 'Smith');
    equal(model.get('details.name.initial'), 'Z');
});


// tests migrated from backbone-nested

// ----- GET --------

  test("#get() 1-1 returns attributes object", function() {
    var doc = create2();
    var name = doc.get('name');
    
    deepEqual(name, {
      first: 'Aidan',
      middle: {
        initial: 'L',
        full: 'Lee'
      },
      last: 'Feldman'
    });
  });

  test("#get() 1-1", function() {
    var doc = create2();
    equal(doc.get('name.first'), 'Aidan');
    equal(doc.get('name.middle.initial'), 'L');
    equal(doc.get('name.last'), 'Feldman');
  });

  test("#get() 1-N dot notation", function() {
    var doc = create2();
    equal(doc.get('addresses.0.city'), 'Brooklyn');
    equal(doc.get('addresses.0.state'), 'NY');
    equal(doc.get('addresses.1.city'), 'Oak Park');
    equal(doc.get('addresses.1.state'), 'IL');
  });

  test("#get() 1-N square bracket notation", function() {
    var doc = create2();
    equal(doc.get('addresses[0].city'), 'Brooklyn');
    equal(doc.get('addresses[0].state'), 'NY');
    equal(doc.get('addresses[1].city'), 'Oak Park');
    equal(doc.get('addresses[1].state'), 'IL');
  });

  test("#get() 1-N returns attributes object", function() {
    var doc = create2();
    deepEqual(doc.get('addresses[0]'), {
      city: 'Brooklyn',
      state: 'NY'
    });

    deepEqual(doc.get('addresses[1]'), {
      city: 'Oak Park',
      state: 'IL'
    });
  });

// ----- SET --------

  test("#set() 1-1 on leaves", function() {
    var doc = create2();
    equal(doc.get('name.first'), 'Aidan');
    equal(doc.get('name.last'), 'Feldman');

    doc.set({'name.first': 'Jeremy'});
    doc.set({'name.last': 'Ashkenas'});

    equal(doc.get('name.first'), 'Jeremy');
    equal(doc.get('name.last'), 'Ashkenas');
  });

  test("#set() 1-1 on deeply nested object", function() {
    var doc = create2();
    equal(doc.get('name.middle.initial'), 'L');

    doc.set({'name.middle.initial': 'D'});

    equal(doc.get('name.middle.initial'), 'D');
  });

  test("#set() 1-1 with object", function() {
    var doc = create2();
    doc.set({
      name: {
        first: 'Jeremy',
        last: 'Ashkenas'
      }
    });

    equal(doc.get('name.first'), 'Jeremy');
    equal(doc.get('name.last'), 'Ashkenas');
  });

  test("#set() 1-1 should override existing array", function() {
    var doc = create2();
    doc.set('addresses', []);
    equal(doc.get('addresses').length, 0);
  });

  test("#set() 1-1 should override existing object", function() {
    var doc = create2();
    doc.set('name', {});
    ok(_.isEmpty(doc.get('name')), 'should return an empty object');
  });

  test("#set() 1-N dot notation on leaves", function() {
    var doc = create2();
    equal(doc.get('addresses.0.city'), 'Brooklyn');
    equal(doc.get('addresses.0.state'), 'NY');
    equal(doc.get('addresses.1.city'), 'Oak Park');
    equal(doc.get('addresses.1.state'), 'IL');

    doc.set({'addresses.0.city': 'Seattle'});
    doc.set({'addresses.0.state': 'WA'});
    doc.set({'addresses.1.city': 'Minneapolis'});
    doc.set({'addresses.1.state': 'MN'});

    equal(doc.get('addresses.0.city'), 'Seattle');
    equal(doc.get('addresses.0.state'), 'WA');
    equal(doc.get('addresses.1.city'), 'Minneapolis');
    equal(doc.get('addresses.1.state'), 'MN');
  });

  test("#set() 1-N square bracket notation on leaves", function() {
    var doc = create2();
    equal(doc.get('addresses[0].city'), 'Brooklyn');
    equal(doc.get('addresses[0].state'), 'NY');
    equal(doc.get('addresses[1].city'), 'Oak Park');
    equal(doc.get('addresses[1].state'), 'IL');

    doc.set({'addresses[0].city': 'Manhattan'});
    doc.set({'addresses[1].city': 'Chicago'});

    equal(doc.get('addresses[0].city'), 'Manhattan');
    equal(doc.get('addresses[0].state'), 'NY');
    equal(doc.get('addresses[1].city'), 'Chicago');
    equal(doc.get('addresses[1].state'), 'IL');
  });

  test("#set() 1-N with an object", function() {
    var doc = create2();
    doc.set({
      'addresses[0]': {
        city: 'Seattle',
        state: 'WA'
      }
    });
    doc.set({
      'addresses[1]': {
        city: 'Minneapolis',
        state: 'MN'
      }
    });

    equal(doc.get('addresses[0].city'), 'Seattle');
    equal(doc.get('addresses[0].state'), 'WA');
    equal(doc.get('addresses[1].city'), 'Minneapolis');
    equal(doc.get('addresses[1].state'), 'MN');
  });

  test("#set() 1-N with an object containing an array", function() {
    var doc = create2();
    doc.set('addresses[0]', {
      city: 'Seattle',
      state: 'WA',
      areaCodes: ['001', '002', '003']
    });
    doc.set('addresses[1]', {
      city: 'Minneapolis',
      state: 'MN',
      areaCodes: ['101', '102', '103']
    });

    deepEqual(doc.get('addresses[0].areaCodes'), ['001', '002', '003']);
    deepEqual(doc.get('addresses[1].areaCodes'), ['101', '102', '103']);
  });

  test("#set() 1-N with an object containing an array where array values are being removed", function() {
    var doc = create2();
    doc.set('addresses[0]', {
      city: 'Seattle',
      state: 'WA',
      areaCodes: ['001', '002', '003']
    });
    doc.set('addresses[0]', {
      city: 'Minneapolis',
      state: 'MN',
      areaCodes: ['101', '102']
    });

    deepEqual(doc.get('addresses[0].areaCodes'), ['101', '102']);
  });

  test("#set() 1-N with an object containing an array where array has been cleared", function() {
    var doc = create2();
    doc.set('addresses[0]', {
      city: 'Seattle',
      state: 'WA',
      areaCodes: ['001', '002', '003']
    });
    doc.set('addresses[0]', {
      city: 'Minneapolis',
      state: 'MN',
      areaCodes: []
    });

    deepEqual(doc.get('addresses[0].areaCodes'), []);
  });


  // ----- HAS --------

  test("#get() 1-1", function() {
    var doc = create2();
    ok(doc.has('name.first'));
    ok(doc.has('name.middle.initial'));
    ok(doc.has('name.last'));
    ok(!doc.has('name.foo'));
  });

  test("#get() 1-N dot notation", function() {
    var doc = create2();
    ok(doc.has('addresses.0'));
    ok(doc.has('addresses.0.city'));
    ok(doc.has('addresses.0.state'));
    ok(doc.has('addresses.1'));
    ok(doc.has('addresses.1.city'));
    ok(doc.has('addresses.1.state'));
    ok(!doc.has('addresses.2'));
  });

  test("#get() 1-N square bracket notation", function() {
    var doc = create2();
    ok(doc.has('addresses[0]'));
    ok(doc.has('addresses[0].city'));
    ok(doc.has('addresses[0].state'));
    ok(doc.has('addresses[1]'));
    ok(doc.has('addresses[1].city'));
    ok(doc.has('addresses[1].state'));
    ok(!doc.has('addresses[2]'));
  });

  // ----- CHANGE EVENTS --------

  test("change event on top-level attribute", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeGender = sinon.spy();

    doc.bind('change', change);
    doc.bind('change:gender', changeGender);

    doc.set({'gender': 'F'});

    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeGender);
  });

  test("change event should fire after attribute is set", function() {
    var doc = create2();
    var callback = function(model){
      equal(model.get('name.first'), 'Bob');
    };

    var change = sinon.spy(callback),
      changeName = sinon.spy(callback),
      changeFirstName = sinon.spy(callback);

    doc.bind('change', change);
    //doc.bind('change:name', changeName);  // works in backbone-nested only
    doc.bind('change:name.*', changeName);  // works in backbone-deepmodel only
    doc.bind('change:name.first', changeFirstName);

    doc.set('name.first', 'Bob');

    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeName);
    sinon.assert.calledOnce(changeFirstName);
  });

  test("change event on nested attribute", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameFirst = sinon.spy();
    var changeNameLast = sinon.spy();
    var changeGender = sinon.spy();
    
    doc.bind('change', change);
    //doc.bind('change:name', changeName);  // works in backbone-nested only
    doc.bind('change:name.*', changeName);  // works in backbone-deepmodel only
    doc.bind('change:name.first', changeNameFirst);

    doc.bind('change:name.last', changeNameLast);
    doc.bind('change:gender', changeGender);

    doc.set({'name.first': 'Bob'});

    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeName);
    sinon.assert.calledOnce(changeNameFirst);

    sinon.assert.notCalled(changeNameLast);
    sinon.assert.notCalled(changeGender);
  });

  test("change event doesn't fire on silent", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameFirst = sinon.spy();

    doc.bind('change', change);
    doc.bind('change:name', changeName);
    doc.bind('change:name.first', changeNameFirst);

    doc.set({'name.first': 'Bob'}, {silent: true});

    sinon.assert.notCalled(change);
    sinon.assert.notCalled(changeName);
    sinon.assert.notCalled(changeNameFirst);
  });

  test("change event doesn't fire if new value matches old value", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameFirst = sinon.spy();

    equal(doc.get('name.first'), 'Aidan');

    doc.bind('change', change);
    doc.bind('change:name', changeName);
    doc.bind('change:name.first', changeNameFirst);

    doc.set({'name.first': 'Aidan'});

    sinon.assert.notCalled(change);
    sinon.assert.notCalled(changeName);
    sinon.assert.notCalled(changeNameFirst);
  });

  test("change event doesn't fire if new value matches old value with objects", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameMiddle = sinon.spy();
    var changeNameMiddleInitial = sinon.spy();

    equal(doc.get('name.middle.initial'), 'L');
    equal(doc.get('name.middle.full'), 'Lee');

    doc.bind('change', change);
    doc.bind('change:name', changeName);
    doc.bind('change:name.middle', changeNameMiddle);
    doc.bind('change:name.middle.initial', changeNameMiddleInitial);

    doc.set({'name.middle': {
      initial: 'L',
      full: 'Lee'
    }});

    sinon.assert.notCalled(change);
    sinon.assert.notCalled(changeName);
    sinon.assert.notCalled(changeNameMiddle);
    sinon.assert.notCalled(changeNameMiddleInitial);
  });

  // TODO: FAILING
  test("change event doesn't fire if validation fails on top level attribute", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameFirst = sinon.spy();

    doc.validate = function(attributes) {
      if (attributes.gender.length > 1) {
        return "Gender should be 'M' or 'F'";
      }
    };

    doc.bind('change', change);
    doc.bind('change:name', changeName);
    doc.bind('change:name.first', changeNameFirst);

    doc.set({'gender': 'Unknown'});

    sinon.assert.notCalled(change);
    sinon.assert.notCalled(changeName);
    sinon.assert.notCalled(changeNameFirst);
  });

  // FAILING
  test("change event doesn't fire if validation fails on deeply nested attribute", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameMiddle = sinon.spy();
    var changeNameMiddleInitial = sinon.spy();

    doc.validate = function(attributes) {
      if (attributes.name.middle.initial.length > 1) {
        return "Middle initial is too long";
      }
    };

    doc.bind('change', change);
    doc.bind('change:name', changeName);
    doc.bind('change:name.middle', changeNameMiddle);
    doc.bind('change:name.middle.initial', changeNameMiddleInitial);

    doc.set({'name.middle': {
      initial: 'ThisIsTooLong',
      full: 'Lee'
    }});

    sinon.assert.notCalled(change);
    sinon.assert.notCalled(changeName);
    sinon.assert.notCalled(changeNameMiddle);
    sinon.assert.notCalled(changeNameMiddleInitial);
  });

  test("attribute change event receives new value", function() {
    var doc = create2();
    doc.bind('change:name', function(model, newVal){
      deepEqual(newVal, {
        'first': 'Bob',
        'middle': {
          'initial': 'L',
          'full': 'Lee'
        },
        'last': 'Feldman'
      });
    });
    doc.bind('change:name.first', function(model, newVal){
      equal(newVal, 'Bob');
    });

    doc.set({'name.first': 'Bob'});
  });

  test("change event on deeply nested attribute", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameMiddle = sinon.spy();
    var changeNameMiddleFull = sinon.spy();
    var changeNameMiddleInitial = sinon.spy();
    var changeNameFirst = sinon.spy();

    doc.bind('change', change);

    doc.bind('change:name.*', changeName);               // only fires in deepmodel
    doc.bind('change:name.middle.*', changeNameMiddle);  // only fires in deepmodel
    //doc.bind('change:name', changeName);               // only fires in backbone-nested
    //doc.bind('change:name.middle', changeNameMiddle);  // only fires in backbone-nested
    doc.bind('change:name.middle.full', changeNameMiddleFull);

    doc.bind('change:name.middle.initial', changeNameMiddleInitial);
    doc.bind('change:name.first', changeNameFirst);

    doc.set({'name.middle.full': 'Leonard'});

    // Confirm all triggers fire once that should
    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeName);
    sinon.assert.calledOnce(changeNameMiddle);
    sinon.assert.calledOnce(changeNameMiddleFull);

    // Confirm other triggers do not fire
    sinon.assert.notCalled(changeNameMiddleInitial);
    sinon.assert.notCalled(changeNameFirst);
  });

  //  FAILING - I think this is because of the overzealous triggering bug
  test("change event on deeply nested attribute with object", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameMiddle = sinon.spy();
    var changeNameMiddleInitial = sinon.spy();
    var changeNameMiddleFull = sinon.spy();
    var changeNameFirst = sinon.spy();
    
    doc.bind('change', change);

    doc.bind('change:name.*', changeName);               // only fires in deepmodel
    doc.bind('change:name.middle.*', changeNameMiddle);  // only fires in deepmodel
    //doc.bind('change:name', changeName);               // only fires in backbone-nested
    //doc.bind('change:name.middle', changeNameMiddle);  // only fires in backbone-nested

    doc.bind('change:name.middle.initial', changeNameMiddleInitial);
    doc.bind('change:name.middle.full', changeNameMiddleFull);

    doc.bind('change:name.first', changeNameFirst);

    doc.set({'name.middle': {
      initial: 'F',
      full: 'Frankenfurter'
    }});
    
    // Confirm all triggers fire once that should
    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeName);
    sinon.assert.calledOnce(changeNameMiddle);
    sinon.assert.calledOnce(changeNameMiddleInitial);
    sinon.assert.calledOnce(changeNameMiddleFull);

    // Confirm other triggers do not fire
    sinon.assert.notCalled(changeNameFirst);
  });

    //FAILING
  test("change event on nested array", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeAddresses = sinon.spy();
    var changeAddresses0 = sinon.spy();
    var changeAddresses0City = sinon.spy();
    var changeAddresses0State = sinon.spy();
    var changeAddresses1 = sinon.spy();
    
    doc.bind('change', change);
    doc.bind('change:addresses', changeAddresses);
    doc.bind('change:addresses[0]', changeAddresses0);
    doc.bind('change:addresses[0].city', changeAddresses0City);
    
    doc.bind('change:addresses[0].state', changeAddresses0State);
    doc.bind('change:addresses[1]', changeAddresses1);

    doc.set({'addresses[0].city': 'New York'});

    // Confirm all triggers fire once that should
    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeAddresses);
    sinon.assert.calledOnce(changeAddresses0);
    sinon.assert.calledOnce(changeAddresses0City);

    // Confirm other triggers do not fire
    sinon.assert.notCalled(changeAddresses0State);
    sinon.assert.notCalled(changeAddresses1);

  });

  // FAILING
  test("change+add when adding to array", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeAddresses = sinon.spy();
    var addAddresses = sinon.spy();
    
    doc.bind('change', change);
    doc.bind('change:addresses', changeAddresses);
    doc.bind('add:addresses', addAddresses);

    doc.set({
      'addresses[2]': {
        city: 'Seattle',
        state: 'WA'
      }
    });

    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeAddresses);
    sinon.assert.calledOnce(addAddresses);

  });

  // FAILING
  test("change+remove when unsetting on array", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeAddresses = sinon.spy();
    var removeAddresses = sinon.spy();
    
    doc.bind('change', change);
    doc.bind('change:addresses', changeAddresses);
    doc.bind('remove:addresses', removeAddresses);

    doc.unset('addresses[1]');

    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeAddresses);
    sinon.assert.calledOnce(removeAddresses);
  });

  test("change+remove when removing from array", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeAddresses = sinon.spy();
    var removeAddresses = sinon.spy();
    
    doc.bind('change', change);
    doc.bind('change:addresses', changeAddresses);
    doc.bind('remove:addresses', removeAddresses);

    doc.remove('addresses[1]');

    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeAddresses);
    sinon.assert.calledOnce(removeAddresses);
  });

  test("change+remove when removing from deep array", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameMiddle = sinon.spy();
    var changeNameMiddleFullAlternates = sinon.spy();
    var removeNameMiddleFullAlternates = sinon.spy();

    doc.set('name.middle', {
      initial: 'L',
      full: 'Limburger',
      fullAlternates: ['Danger', 'Funny', 'Responsible']
    });
    
    doc.bind('change', change);
    doc.bind('change:name', changeName);
    doc.bind('change:name.middle', changeNameMiddle);
    doc.bind('change:name.middle.fullAlternates', changeNameMiddleFullAlternates);
    doc.bind('remove:name.middle.fullAlternates', removeNameMiddleFullAlternates);

    doc.remove('name.middle.fullAlternates[1]');

    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeName);
    sinon.assert.calledOnce(changeNameMiddle);
    sinon.assert.calledOnce(changeNameMiddleFullAlternates);
    sinon.assert.calledOnce(removeNameMiddleFullAlternates);
  });




  // ----- CHANGED_ATTRIBUTES --------

  // FAILING
  test("#changedAttributes() should return the attributes for the full path and all sub-paths", function() {
    var doc = create2();
    doc.bind('change', function(){
      deepEqual(this.changedAttributes(), {
        name: {
          first: 'Aidan',
          middle: {
            initial: 'L',
            full: 'Limburger'
          },
          last: 'Feldman'
        },
        'name.middle': {
          initial: 'L',
          full: 'Limburger'
        },
        'name.middle.full': 'Limburger'
      });
    });
    
    doc.set({'name.middle.full': 'Limburger'});
  });

  // FAILING
  test("#changedAttributes() should return the attributes for the full path and all sub-paths for conventional set", function() {
    var doc = create2();
    doc.bind('change', function(){
      deepEqual(this.changedAttributes(), {
        name: {
          first: 'Aidan',
          middle: {
            initial: 'L',
            full: 'Limburger'
          },
          last: 'Feldman'
        },
        'name.middle': {
          initial: 'L',
          full: 'Limburger'
        },
        'name.middle.full': 'Limburger'
      });
    });
    
    //Set using conventional JSON - emulates a model fetch
    doc.set({
      gender: 'M',
      name: {
        first: 'Aidan',
        middle: {
          initial: 'L',
          full: 'Limburger'
        },
        last: 'Feldman'
      },
      addresses: [
        {
          city: 'Brooklyn',
          state: 'NY'
        },
        {
          city: 'Oak Park',
          state: 'IL'
        }
      ]
    });
  });
  
  // FAILING
  test("#changedAttributes() should clear the nested attributes between change events", function() {
    var doc = create2();
    doc.set({'name.first': 'Bob'});

    doc.bind('change', function(){
      deepEqual(this.changedAttributes(), {
        name: {
          first: 'Bob',
          middle: {
            initial: 'L',
            full: 'Lee'
          },
          last: 'Dylan'
        },
        'name.last': 'Dylan'
      });
    });

    doc.set({'name.last': 'Dylan'});
  });

  test("#changedAttributes() should clear the nested attributes between change events with validation", function() {
    var doc = create2();
    doc.validate = function(attributes) {
      if (attributes.name.first.length > 15) {
        return "First name is too long";
      }
    };
  
    doc.set({'name.first': 'TooLongFirstName'});

    doc.bind('change', function(){
      deepEqual(this.changedAttributes(), {
        name: {
          first: 'Aidan',
          middle: {
            initial: 'L',
            full: 'Lee'
          },
          last: 'Dylan'
        },
        'name.last': 'Dylan'
      });
    });

    doc.set({'name.last': 'Dylan'});
  });

  // ----- CLEAR --------

  test("#clear()", function() {
    var doc = create2();
    doc.clear();
    deepEqual(doc.attributes, {}, 'it should clear all attributes');
  });

  test("#clear() triggers change events", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameFirst = sinon.spy();
    var changeNameLast = sinon.spy();

    doc.bind('change', change);
    doc.bind('change:name', changeName);
    doc.bind('change:name.first', changeNameFirst);
    doc.bind('change:name.last', changeNameLast);

    doc.clear();

    sinon.assert.calledOnce(change);
    sinon.assert.calledOnce(changeName);
    sinon.assert.calledOnce(changeNameFirst);
    sinon.assert.calledOnce(changeNameLast);
  });

  test("#clear() sets correct .changedAttributes", function() {
    var doc = create2();
    doc.bind('change', function(){
      deepEqual(this.changedAttributes(), {
        'addresses': null,
        'addresses[0]': null,
        'addresses[0].city': null,
        'addresses[0].state': null,
        'addresses[1]': null,
        'addresses[1].city': null,
        'addresses[1].state': null,
        'gender': null,
        'name': null,
        'name.first': null,
        'name.last': null,
        'name.middle': null,
        'name.middle.full': null,
        'name.middle.initial': null
      });
    });
    doc.clear();
  });

  test("#clear() silent triggers no change events", function() {
    var doc = create2();
    var change = sinon.spy();
    var changeName = sinon.spy();
    var changeNameFirst = sinon.spy();

    doc.bind('change', change);
    doc.bind('change:name', changeName);
    doc.bind('change:name.first', changeNameFirst);

    doc.clear({silent: true});

    sinon.assert.notCalled(change);
    sinon.assert.notCalled(changeName);
    sinon.assert.notCalled(changeNameFirst);
  });


  // ----- UNSET --------

  test("#unset() top-level attribute", function() {
    var doc = create2();
    doc.unset('name');
    equal(doc.get('name'), undefined);
    equal(doc.get('gender'), 'M', "it shouldn't unset other attributes");
  });

  test("#unset() nested attribute", function() {
    var doc = create2();
    doc.unset('name.first');
    deepEqual(doc.get('name'), {
      middle: {
        initial: 'L',
        full: 'Lee'
      },
      last: 'Feldman'
    });
    equal(doc.get('gender'), 'M', "it shouldn't unset other attributes");
  });


  // ----- TO_JSON --------

  test("#toJSON()", function() {
    var doc = create2();
    var json = doc.toJSON();
    deepEqual(json, doc.attributes);
  });


// ----- ADD --------

  test("#add() on nested array succeeds", function() {
    var doc = create2();
    var attrs = {
      city: 'Lincoln',
      state: 'NE'
    };

    doc.add('addresses', attrs);

    deepEqual(doc.get('addresses[2]'), attrs);
  });

  test("#add() should complain if existing value isn't an array", function() {
    var doc = create2();
    var errorThrown = false;

    try {
      doc.add('name', 'foo');
    } catch (e) {
      errorThrown = true;
    }

    ok(errorThrown, "error should have been thrown");
  });

  test("#add() on nested array should trigger 'add' event", function() {
    var doc = create2();
    var addAddresses = sinon.spy();

    doc.bind('add:addresses', addAddresses);

    doc.add('addresses', {
      city: 'Lincoln',
      state: 'NE'
    });

    sinon.assert.calledOnce(addAddresses);
  });

  test("#add() on nested array should trigger 'add' event after model is updated", function() {
    var doc = create2();
    var callbackFired = false;
    var initialLength = doc.get('addresses').length;
    var newLength;

    doc.bind('add:addresses', function(model, newAddr){
      newLength = doc.get('addresses').length;
      callbackFired = true;
    });
    doc.add('addresses', {
      city: 'Lincoln',
      state: 'NE'
    });

    ok(callbackFired, "callback wasn't fired");
    equal(newLength, initialLength + 1, "array length should be incremented prior to 'add' event firing");
  });

  test("#add() should return the model to mimic set() functionality", function() {
    var doc = create2();
    var model;

    model = doc.set('addresses.0.city', 'Boston');

    equal(model, doc);

    model = doc.add('addresses', {
      city: 'Lincoln',
      state: 'NE'
    });

    equal(model, doc);
  });

  test("#add() on nested array fails if validation fails", function() {
    var doc = create2();
    var addAddresses = sinon.spy();

    equal(doc.get('addresses').length, 2);

    doc.bind('add:addresses', addAddresses);

    doc.validate = function(attributes) {
      for (var i = attributes.addresses.length - 1; i >= 0; i--) {
        if (attributes.addresses[i].state.length > 2) {
          return "Must use 2 letter state abbreviation";
        }
      }
    };

    var attrs = {
      city: 'Lincoln',
      state: 'Nebraska' // Longer than 2 letters, validation should fail
    };

    doc.add('addresses', attrs);

    sinon.assert.notCalled(addAddresses);
    equal(doc.get('addresses[2]'), undefined);
  });


// ----- REMOVE --------

  test("#remove() on nested array should remove the element from the array", function() {
    var doc = create2();
    var addr0 = doc.get('addresses[0]'),
      addr1 = doc.get('addresses[1]');

    doc.remove('addresses[0]');

    equal(doc.get('addresses').length, 1);
    deepEqual(doc.get('addresses[0]'), addr1);
  });

  test("#remove() on nested array should trigger 'remove' event", function() {
    var removeAddresses = sinon.spy();
    var doc = create2();
    doc.bind('remove:addresses', removeAddresses);

    doc.remove('addresses[0]');
    
    sinon.assert.calledOnce(removeAddresses);
    equal(doc.get('addresses').length, 1);

    doc.remove('addresses[0]');

    sinon.assert.calledTwice(removeAddresses);
    equal(doc.get('addresses').length, 0);
  });

  test("#remove() on nested array should trigger 'remove' event after model is updated", function() {
    var doc = create2();
    var callbackFired = 0;
    var initialLength = doc.get('addresses').length;
    var newLength;
   

    doc.bind('remove:addresses', function(){
      newLength = doc.get('addresses').length;
      callbackFired++;
    });

    doc.remove('addresses[0]');
    equal(callbackFired, 1, "callback should have fired once");
    equal(newLength, initialLength - 1, "array length should be decremented prior to 'remove' event firing");

    doc.remove('addresses[0]');
    equal(callbackFired, 2, "callback should have fired twice");
    equal(newLength, initialLength - 2, "array length should be decremented prior to 'remove' event firing");
  });

  test("#remove() on non-array should raise error", function() {
    var errorRaised = false;
    var doc = create2();

    try {
      doc.remove('missingthings[0]');
    } catch(e){
      errorRaised = true;
    }

    ok(errorRaised, "error wasn't raised");
  });

test("#remove() should return the model to mimic set() functionality", function() {
    var doc = create2(),
        model;

    model = doc.set('addresses.0.city', 'Boston');

    equal(model, doc);

    model = doc.remove('addresses[0]');

    equal(model, doc);
  });
