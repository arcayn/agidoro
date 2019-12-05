var dbHandler = (function () {
    var DB = {};
    var datastore = null;
    const types = { 't': 'tasks', 'p': 'pomodoros', 'top': 'topics', 's': 'stats' };

    DB.open = (type, callback) => {
        var version = 1;
        var request = indexedDB.open(types[type], version);


        request.onupgradeneeded = function (e) {
            var db = e.target.result;

            e.target.transaction.onerror = DB.onerror;

            if (db.objectStoreNames.contains(types[type])) {
                db.deleteObjectStore(types[type]);
            }

            var store = db.createObjectStore(types[type], {
                keyPath: 'uid'
            });
        };

        request.onsuccess = function (e) {
            datastore = e.target.result;
            callback();
        };

        request.onerror = DB.onerror;
    };

    DB.fetch = (type, callback) => {
        var db = datastore;
        var transaction = db.transaction([types[type]], 'readwrite');
        var objStore = transaction.objectStore(types[type]);

        var keyRange = IDBKeyRange.lowerBound(0);
        var cursorRequest = objStore.openCursor(keyRange);

        var tasks = [];

        transaction.oncomplete = function (e) {
            callback(tasks);
        };

        cursorRequest.onsuccess = function (e) {
            var result = e.target.result;

            if (!result) {
                return;
            }

            tasks.push(result.value);

            result.continue();
        };

        cursorRequest.onerror = DB.onerror;
    };

    DB.fetchById = (type, id, callback) => {
        var db = datastore;
        var transaction = db.transaction([types[type]], 'readwrite');
        var objStore = transaction.objectStore(types[type]);

        var request = objStore.get(id);

        request.onsuccess = function (e) {
            var result = e.target.result;

            if (!result) {
                return;
            }

            callback(result);
        }

        request.onerror = DB.onerror;
    };

    DB.add = (type, obj, callback) => {
        var db = datastore;
        var transaction = db.transaction([types[type]], 'readwrite');
        var objStore = transaction.objectStore(types[type]);

        var request = objStore.put(obj);

        request.onsuccess = function (e) {
            callback(obj);
        };

        request.onerror = DB.onerror;
    };

    DB.delete = (type, id, callback) => {
        var db = datastore;
        var transaction = db.transaction([types[type]], 'readwrite');
        var objStore = transaction.objectStore(types[type]);

        var request = objStore.delete(Number(id));

        request.onsuccess = function (e) {
            callback();
        }

        request.onerror = DB.onerror;
    };

    DB.modify = (type, id, modValues, callback) => {
        DB.fetchById(type, id, (obj) => {
            Object.keys(modValues).forEach((k) => {
                obj[k] = modValues[k];
            });
            DB.delete(type, id, () => {
                DB.add(type, obj, (ob) => {
                    callback(ob);
                });
            });
        });
    };

    DB.onerror = (e) => {
        console.log(e);
    };

    return DB;
}());