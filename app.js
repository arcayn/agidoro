const types = ["pomodoro", "short break", "long break"];
const backgrounds = ["#f2624b", "#3e86f9", "#2d8e00"];
var taskArray = [];
var topicArray = [];

const punc = [" ", ",", ".", ":"];

var settings = {
    startMinutes: [25, 4, 25],
    startSeconds: [0, 0, 0],
    setLength: 4,
    auto: [1, 0],
    notifications: true
}

var setId = "";

var started = false;
var inProgress = false;
var minutes = 0;
var seconds = 0;
var counts = [0, 0, 0];
var type = 0;
var timerID = 0;
var completedTasks = [];
var inProgressTasks = [];
var timeStarted = 0;

var spacer = " ";
var mQuery;

function toggleColon(x) {
    spacer = (x.matches) ? " " : " : ";
    updateTimer(true);
}

var loadDb = () => {
    currentUid = window.localStorage.getItem("currentUid") || 0;
    dbHandler.open('t', () => {
        dbHandler.fetch('t', (arr) => {
            taskArray = arr;
            dbHandler.open('top', () => {
                dbHandler.fetch('top', (arr) => {
                    topicArray = arr;
                    populateTasks();
                });
            });
        });
    });
};

var getTopic = (id) => {
    var ret;
    topicArray.forEach((t) => {
        if (t.uid == id)
            ret = t;
    });
    return ret;
};

var getTask = (id) => {
    var ret;
    taskArray.forEach((t) => {
        if (t.uid == id)
            ret = t;
    });
    return ret;
};

var getTaskIndex = (id) => {
    var ret;
    taskArray.forEach((t, i) => {
        if (t.uid == id)
            ret = i;
    });
    return ret;
};

var addTaskToDb = (id) => {
    dbHandler.open('t', () => {
        dbHandler.add('t', getTask(id), () => {
            return;
        });
    });
};
var baseHTML = `
<div class="card text-left" style="min-height: 8em; box-shadow: 2px 2px 10px -5px black; display: inline-block; width: 20em" id="{{uid}}-card">
                <div class="card-body" style="position: absolute; width: 100%; top: 50%; transform: translateY(-50%)">
                    <h5 class="card-title"><span class="uid">{{uid}}</span>{{title}}<span class="iconset" id="{{uid}}-iconset">{{icons}}</span></h5>
                    {{deadline}}<span style="font-size: 0.9em">{{desc}}</span>{{badges}}
                </div>
            </div>`;
var badgeBase = `<div class="badgeContainer">{{badges}}</div>`;
var deadlineHTML = `<span class="deadline">deadline: {{dl}}</span>`;
var blockersHTML = `<span class="blockers">blocked by:{{blockers}}</span>`;
var blockerHTML = `<span class="taskNumber">{{task}}</span>`
var badgeHTML = `<span class="badge badge-{{class}} mr-1"{{color}}>{{name}}</span>`;
var colorHTML = ` style="background-color: {{col}}" `;

var constructTemplate = (template, vars) => {
    Object.keys(vars).forEach((k) => {
        var re = new RegExp(`{{${k}}}`, "g");
        template = template.replace(re, vars[k]);
    });
    return template;
};

var makeIcon = (name, classname = "") => {
    return `<ion-icon name="${name}" class="${classname} ${name}-icon"></ion-icon>`;
};

var getIcons = (t) => {
    var iconlist = "";
    iconlist += makeIcon("checkmark-circle-outline");
    iconlist += makeIcon("create");
    iconlist += makeIcon("trash");
    return iconlist;

};
var getTaskHtml = (t) => {
    if (t.deleted)
        return;
    var badges = "";
    if (t.topics) {
        var interior = "";
        t.topics.forEach((top) => {
            if (getTopic(top).display) {
                var color = "";
                if (getTopic(top).color)
                    color = constructTemplate(colorHTML, { col: getTopic(top).color });
                interior += constructTemplate(badgeHTML, { "color": color, "class": "primary", "name": getTopic(top).name })
            }
        });
        badges = constructTemplate(badgeBase, { "badges": interior });
    }
    var deadline = "";
    if (t.deadline)
        deadline = constructTemplate(deadlineHTML, { "dl": t.deadline });
    var blockers = ""
    if (t.blockers.length) {
        var blockingTasks = "";
        t.blockers.forEach((b) => {
            blockingTasks += constructTemplate(blockerHTML, { "task": b })
        });
        blockers = constructTemplate(blockersHTML, { "blockers": blockingTasks });
    }

    var desc = "";
    for (var i = 0; i < t.content.length; i++) {
        if (t.content[i] == "\n")
            break;
        if (i > 100 && punc.includes(t.content[i])) {
            desc += "...";
            break;
        }
        if (i > 110) {
            desc += "...";
            break;
        }
        desc += t.content[i];
    }

    return constructTemplate(baseHTML, { "desc": desc, "icons": getIcons(t), "blockers": blockers, "isBlocked": (t.blockers.length) ? " blocked" : "", "title": t.title, "deadline": deadline, "badges": badges, "uid": t.uid });
};
var getIconUid = (e) => {
    return e.parent().attr('id').substr(0, e.parent().attr('id').length - 8);
};

var removeTask = (id) => {
    $(`#${id}-card`).remove();
    addTaskToDb(id);
}

var openTaskForm = (id) => {
        let t = getTask(id);
        $("#taskModalLabel").text("Edit Task");
        $("#taskTitle").val(t.title);
        $("#taskDeadline").val(t.deadline);
        $("#taskDesc").val(t.content);
        $("#taskEditMode").text(id);
    $('#taskModal').modal('show');
}

var setOnclicks = () => {
    $('.checkmark-circle-outline-icon').unbind().click(function () {
        var uid = getIconUid($(this));
        let t = getTask(uid);
        t.status = "completed";
        t.completed = Date.now();
        removeTask(uid);
    });
    $('.create-icon').unbind().click(function () {
        var uid = getIconUid($(this));
        openTaskForm(uid);
    });
    $('.trash-icon').unbind().click(function () {
        var uid = getIconUid($(this));
        let t = getTask(uid);
        if (confirm(`Remove task from active?`)) {
            t.status = "progress";
            removeTask(uid);
        }
    });
};

var populateTasks = () => {
    inProgressTasks = [];
    taskArray.forEach((t) => {
        if (t.status == "active") {
            $("#tasks").append(getTaskHtml(t));
            inProgressTasks.push(t.title);
        }
    });
    setOnclicks();
}


var savePomodoro = () => {
    var pomodoro = {
        "set": setId,
        "completedTasks": completedTasks,
        "activeTasks": inProgressTasks,
        "length": [settings.startMinutes[0], settings.startSeconds[0]],
        "breakLength": [settings.startMinutes[1], settings.startSeconds[1]],
        "timeBegun": timeStarted,
        "timeComplete": Date.now(),
        "uid": (parseInt(localStorage.getItem("recentPomodoro"), 10) || 0) + 1
    };

    localStorage.setItem("recentPomodoro", pomodoro.uid);

    dbHandler.open('p', () => {
        dbHandler.add('p', pomodoro, () => {
            console.log("added");
        });
    });
}

var saveState = () => {
    var stateObj = {
        "set": setId,
        "counts": counts,
        "timeBegun": timeStarted,
        "state": type,
        "completedTasks": completedTasks,
        "inProgress": inProgress,
        "timeSince": Date.now(),
        "minutes": minutes,
        "seconds": seconds,
    }
    window.localStorage.setItem("state", JSON.stringify(stateObj));
}

var notify = (text) => {
    if (!settings['notifications'])
        return;

    if (!("Notification" in window)) {
        settings['notifications'] = false;
        window.localStorage.setItem("settings", JSON.stringify(settings));
        return;
    }

    if (Notification.permission !== "granted") {
        Notification.requestPermission().then((p) => {
            if (p == "granted") {
                notify(text);
            }
            else {
                settings['notifications'] = false;
                window.localStorage.setItem("settings", JSON.stringify(settings));
            }
        });
    }

    if (Notification.permission === "granted") {
        var options = {
            body: text,
        };
        var n = new Notification("agidoro", options);
    }
};


var alertComplete = () => {

    $('#completionModal').modal('toggle');
};

var recalcPercent = (cp) => {

    dbHandler.open('percentage', () => {
        dbHandler.fetch('percentage', (arr) => {
            percentObject = arr;
            percentObject["iters"] = percentObject["iters"] + 1;
            percentObject["percent"] = Math.floor((percentObject["percent"] * (percentObject["iters"] - 1) + cp) / (percentObject["iters"]));
        });
    });

}

var finishSet = (natural) => {
    inProgress = false;
    started = false;
    $("#stopButton").addClass("btn-disabled");
    type = 0;
    window.localStorage.setItem("prevSet", setId);
    setId = "";
    seconds = settings.startSeconds[0];
    minutes = settings.startMinutes[0];

    completionPercentage = Math.floor((counts[0] / settings.setLength) * 100);
    //recalcPercent(completionPercentage);

    counts = [0, 0, 0];
    $("#startButton").text("begin");
    updateTimer(true);
    clearTimeout(timerID);
    if (natural) {
        alertComplete();
    }
    window.localStorage.removeItem("state");
}

var nextPomodoro = () => {
    counts[type]++;
    completedTasks = [];
    if (type == 1) {
        type = 0;
        notify("Break's over! Time to get going on your next pomodoro");
        if (!settings.auto[0])
            pauseTimer();
    }
    else if (type == 0) {
        type = 1;
        savePomodoro();
        if (counts[0] >= settings.setLength) {
            type = 2;
        }
        notify("Pomodoro #" + (counts[0]).toString() + " complete! Time for a " + settings.startMinutes[type].toString() + " minute break!");
        if (!settings.auto[1])
            pauseTimer();
    }
    else if (type == 2) {
        if (started)
            notify("Long break complete! Time to get started on your next set");
        finishSet(true);
        return;
    }
    timeStarted = Date.now();
    minutes = settings.startMinutes[type];
    seconds = settings.startSeconds[type];
    updateTimer(true);
}

var testNext = () => {
    if (minutes == -1) {
        nextPomodoro();
        return;
    }
    updateTimer();
}

var updateTimer = (force = false) => {
    if (inProgress || force) {
        $("#pomodoroCounter").text(types[type] + " #" + (counts[type] + 1).toString());
        $("#timerBox").css("background-color", backgrounds[type]);
        $("#timerDigits").text(minutes.toString().padStart(2, '0') + spacer + seconds.toString().padStart(2, '0'));
        
    }
}

var decrementTime = () => {
    if (inProgress) {
        seconds--;
        if (seconds < 0) {
            seconds = 59;
            minutes--;
        }
        testNext();
    }
    if (started) {
        console.log(started);
        saveState();
    }
}

var startSession = (setIdPre = false) => {
    started = true;
    $("#stopButton").removeClass("btn-disabled");
    if (!setIdPre)
        setId = Date.now().toString() + Math.floor(Math.random() * 10000).toString();
    timerID = setInterval(function () {
        decrementTime();
    }, 1000);
}

var startTimer = () => {
    if (!started)
        startSession();
    inProgress = true;
    $("#startButton").text("pause");
    $("#stopButton").text("continue");
    timeStarted = Date.now();
}

var pauseTimer = () => {
    inProgress = false;
    $("#startButton").text("resume");
    $("#stopButton").text("finish");
}

$("#startButton").click(function() {
    if ($(this).text() === "begin" || $(this).text() === "resume") {
        startTimer();
    }
    else if ($(this).text() === "pause") {
        pauseTimer();      
    }
});

$("#stopButton").click(function () {
    if (!started) { }
    else if ($(this).text() === "finish") {
        if (confirm("Are you sure you want to finish this set now? (Your current times will be lost)")) { finishSet(false) };
    }
    else if ($(this).text() === "continue") {
        nextPomodoro();
    }
});

var updateTask = (id) => {
    var old = $(`#${id}-card`)
    old.after(getTaskHtml(getTask(id)));
    old.remove();
    setOnclicks();
}

var loadState = () => {
    minutes = settings.startMinutes[0];
    seconds = settings.startSeconds[0];
    type = 0;
    if (window.localStorage.getItem("state")) {
        var prevState = JSON.parse(window.localStorage.getItem("state"));
        setId = prevState.set;
        counts = prevState.counts;
        timeStarted = prevState.timeBegun;
        type = prevState.state;
        completedTasks = prevState.completedTasks;
        inProgress = prevState.inProgress;
        minutes = prevState.minutes;
        seconds = prevState.seconds;
        $("#startButton").text("resume");
        $("#stopButton").text("finish");


        if (inProgress) {
            $("#startButton").text("pause");
            $("#stopButton").text("continue");
            var allSeconds = [settings.startSeconds[0] + (settings.startMinutes[0] * 60), settings.startSeconds[1] + (settings.startMinutes[1] * 60), settings.startSeconds[2] + (settings.startMinutes[2] * 60)]
            var elapsedTime = Math.floor((Date.now() - prevState.timeSince) / 1000);

            var setSeconds = allSeconds[0] * settings.setLength + allSeconds[1] * (settings.setLength - 1) + allSeconds[2];

            if (elapsedTime > setSeconds) {
                finishSet(true);
                return;
            }
            console.log(elapsedTime);
            for (var i = 0; i < elapsedTime; i++) {
                if (inProgress) {
                    decrementTime();
                }
                else {
                    break;
                }
            }
        }
        startSession();

    }
}

$(document).ready(function () {
    if (window.localStorage.getItem("settings"))
        settings = JSON.parse(window.localStorage.getItem("settings"));
    loadState();
    mQuery = window.matchMedia("(max-width: 770px)");
    toggleColon(mQuery);
    mQuery.addListener(toggleColon);
    updateTimer(true);
    loadDb();
    $('#timerBox').css("opacity", 1);
    $('#saveTask').click(function () {
            let t = getTask(parseInt($("#taskEditMode").text()));
            var newTask = {
                blockers: [],
                completed: t.completed,
                content: $("#taskDesc").val(),
                created: t.created,
                deadline: $("#taskDeadline").val(),
                deleted: t.deleted,
                status: t.status,
                tags: t.tags,
                title: $("#taskTitle").val() || t.title,
                topics: [],
                uid: t.uid
            };
            taskArray.splice(getTaskIndex(parseInt($("#taskEditMode").text())), 1);
        taskArray.push(newTask);
        addTaskToDb(newTask.uid);
        updateTask(newTask.uid);
        $('#taskModal').modal('hide');
    });
});

$('#settingsModal').on('show.bs.modal', function (event) {
    $("#pomodoroLengthM").val(settings.startMinutes[0]);
    $("#sBreakLengthM").val(settings.startMinutes[1]);
    $("#lBreakLengthM").val(settings.startMinutes[2]);
    $("#pomodoroLengthS").val(settings.startSeconds[0]);
    $("#sBreakLengthS").val(settings.startSeconds[1]);
    $("#lBreakLengthS").val(settings.startSeconds[2]);

    $("#setLength").val(settings.setLength);

    $("#pomodoroAutomatic").prop("checked", settings.auto[0]);
    $("#breakAutomatic").prop("checked", settings.auto[1]);

    $("#notifs").prop("checked", settings.notifications);
})

$("#saveSettings").click(function () {
    settings.startMinutes[0] = $("#pomodoroLengthM").val();
    settings.startMinutes[1] = $("#sBreakLengthM").val();
    settings.startMinutes[2] = $("#lBreakLengthM").val();
    settings.startSeconds[0] = $("#pomodoroLengthS").val();
    settings.startSeconds[1] = $("#sBreakLengthS").val();
    settings.startSeconds[2] = $("#lBreakLengthS").val();

    settings.setLength = $("#setLength").val();

    settings.auto[0] = $("#pomodoroAutomatic").prop("checked");
    settings.auto[1] = $("#breakAutomatic").prop("checked");

    settings.notifications = $("#notifs").prop("checked");

    window.localStorage.setItem("settings", JSON.stringify(settings));

    if (!started) {
        minutes = settings.startMinutes[0];
        seconds = settings.startSeconds[0];
        updateTimer(true);
    }
    $("#settingsModal").modal("hide");
});