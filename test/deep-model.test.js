module("DeepModel");

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
    
        var triggered1 = triggered2 = false;
    
        model.bind('change:user.name.first', function(model, val) {
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
            'change'
        ]);
    })();
});
