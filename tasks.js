var taskArray = [];
var topicArray = [];
var activeCount = 0;

const punc = [" ", ",", ".", ":"];

var settings = {
    startMinutes: [25, 4, 25],
    startSeconds: [0, 0, 0],
    setLength: 4,
    auto: [1, 0],
    notifications: true
}

var blockerOptions = "";
var topicOptions = "";

var currentUid = 0;
var currentTopicUid = 1;

var clearColumns = () => {
    $(".cardContainer").html("");
};

var loadDb = () => {
    currentUid = window.localStorage.getItem("currentUid") || 0;
    currentTopicUid = window.localStorage.getItem("currentTopicUid") || 0;
    dbHandler.open('t', () => {
        dbHandler.fetch('t', (arr) => {
            taskArray = arr;
            dbHandler.open('top', () => {
                dbHandler.fetch('top', (arr) => {
                    topicArray = arr;
                    populateTasks();
                    showColumns();
                    genDropdownOptions();
                    checkBlockers();
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

var addTopicToDb = (id) => {
    dbHandler.open('top', () => {
        dbHandler.add('top', getTopic(id), () => {
            return;
        });
    });
};

var baseHTML = `<div class="card {{width}}" style="margin-left: auto; margin-right: auto; box-shadow: 2px 2px 10px -5px black;" id="{{uid}}-card"><div class="card-body{{isBlocked}}"><h5 class="card-title"><span class="uid">{{uid}}</span>{{title}}<span class="iconset" id="{{uid}}-iconset">{{icons}}</span></h5>
{{blockers}}{{deadline}}<span style="font-size: 0.9em">{{desc}}</span>{{badges}}</div></div>`;
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
    if (t.status == "backlog" && !t.blockers.length)
        iconlist += makeIcon("arrow-dropright-circle");
    if (t.status == "progress") {
        iconlist += makeIcon("arrow-dropleft-circle");
        if (!t.blockers.length)
            iconlist += makeIcon("flash");
    }
    if (t.status == "active")
        iconlist += makeIcon("flash", "active-flash-icon");
    iconlist += makeIcon("create");
    iconlist += makeIcon("trash");
    return iconlist

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
    
    return constructTemplate(baseHTML, { "desc": desc, "width": (t.status == "active") ? "halfWidth" : "fullWidth", "icons": getIcons(t), "blockers": blockers, "isBlocked": (t.blockers.length) ? " blocked" : "", "title": t.title, "deadline": deadline, "badges": badges, "uid": t.uid });
};

var toggleActive = (id) => {
    let t = getTask(id);
    t.status = (t.status == "active") ? "progress" : "active";
    activeCount += (t.status == "active") ? 1 : -1;
    addTaskToDb(id);
    updateTask(t);
};

var setOnclicks = () => {
    $('.arrow-dropright-circle-icon').unbind().click(function () {
        var uid = getIconUid($(this));
        getTask(uid).status = "progress";
        addTaskToDb(uid);
        updateTask(getTask(uid));
    });
    $('.arrow-dropleft-circle-icon').unbind().click(function () {
        var uid = getIconUid($(this));
        getTask(uid).status = "backlog";
        addTaskToDb(uid);
        updateTask(getTask(uid));
    });
    $('.create-icon').unbind().click(function () {
        var uid = getIconUid($(this));
        openTaskForm(uid);
    });
    $('.flash-icon').unbind().click(function () {
        var uid = getIconUid($(this));
        toggleActive(uid);
    });
    $('.trash-icon').unbind().click(function () {
        var uid = getIconUid($(this));
        if (confirm(`Are you sure you want to delete task #${uid}?`)) {
            dbHandler.open('t', () => {
                dbHandler.delete('t', uid, () => { console.log("deleted"); });
            });
            if (getTask(uid).status == "active")
                activeCount--;
            checkBlockers();
            getTask(uid).deleted = true;
            updateTask(getTask(uid));
            taskArray.splice(getTaskIndex(uid), 1);
        }
    });
};

var updateTask = (t) => {
    genDropdownOptions();
    console.log(t.uid);
    var old = $(`#${t.uid}-card`);
    console.log(old);
    console.log(old.parent());
    if (old.parent().attr("id")[0] == t.status[0])
        old.after(getTaskHtml(t));
    else {
        $(`#${t.status}Cards`).append(getTaskHtml(t));
    }
        if (!!activeCount)
            $("#activeRow").css("display", "block");
        else
            $("#activeRow").css("display", "none");
    old.remove();
    setOnclicks();
};

var populateTasks = (update = false) => {
    let active = 0;
    taskArray.forEach((t) => {
        $(`#${t.status}Cards`).append(getTaskHtml(t));
        if (t.status == "active")
            active++;
    });
    if (!active)
        $("#activeRow").css("display", "none");
    activeCount = active
    setOnclicks();

};

var checkBlockers = () => {
    var ts = []
    taskArray.forEach((t) => {
        if (!!t.blockers.length && !t.deleted) {
            var count = 0;
            t.blockers.forEach((b, i) => {
                if (!getTask(b)) {
                    t.blockers.splice(i, 1);
                    count++;
                }
                else if (getTask(b).deleted || getTask(b).status == "completed") {
                    t.blockers.splice(i, 1);
                    count++;
                }
            });
            if (!!count) {
                addTaskToDb(t.uid);
                updateTask(t);
            }
        }
    });
    return ts;
}

var updateColumns = () => {
    $(".cardContainer").css("opacity", 0);
    clearColumns();
    checkBlockers();
    populateTasks(true);
    $(".cardContainer").css("opacity", 1);
}

var showColumns = () => {
    $(".cardContainer").collapse("show");
};

var addBlocker = (option = -1) => {
    var blockerHTML = `<div class="col-md-12">
                                <select class="form-control blocker-component blocker-select" style="display: inline; width: 90%">
                                    ${blockerOptions}
                                </select>
                                <button type="button" style="display: inline" class="btn btn-light blocker-component remove-blocker" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>`;
    var blockerel = $(blockerHTML); 
    $('#blockersLabel').after(blockerel);
    if (option != -1)
        blockerel.find(".blocker-select").val(option);   
    $('.remove-blocker').unbind().click(function () {
        $(this).parent().remove();
    });
}
var addTopic = (option = -1) => {
    var blockerHTML = `<div class="col-md-12">
                                <select class="form-control topic-component topic-select" style="display: inline; width: 90%">
                                    ${topicOptions}
                                </select>
                                <button type="button" style="display: inline" class="btn btn-light topic-component remove-topic" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>`;
    var blockerel = $(blockerHTML);
    $('#topicsLabel').after(blockerel);
    if (option != -1)
        blockerel.find(".topic-select").val(option);
    $('.remove-topic').unbind().click(function () {
        $(this).parent().remove();
    });
}

var openTopicForm = () => {
    $("#addTopicButton").unbind().click(() => { addTopicOption(); });
    $(".topic-form").remove();
    $("#topicsModal").modal("show");
    topicArray.forEach((t) => {
        addTopicOption(t.uid);
    });
    $("#saveTopics").unbind().click(() => {
        let prevTopics = topicArray.map(t => t.uid);
        topicArray = [];
        $(".topic-form").each(function (i) {
            let topicObj = {
                name: $(this).find(".topic-name").val(),
                color: $(this).find(".topic-color").val(),
                uid: parseInt($(this).find(".topUid").text()),
                display: true
            };
            topicArray.push(topicObj);
        });
        let currentTopics = [];
        topicArray.forEach((t) => {
            currentTopics.push(t.uid);
            addTopicToDb(t.uid);
        });
        window.localStorage.setItem("currentTopicUid", currentTopicUid);
        genDropdownOptions();
        taskArray.forEach((t) => {
            t.topics.forEach((top, i) => {
                if (!currentTopics.includes(parseInt(top)))
                    t.topics.splice(i, 1);
            });
            addTaskToDb(t.uid);
            updateTask(t);
        });
        prevTopics.forEach((top) => {
            if (!currentTopics.includes(top)) {
                dbHandler.open('top', () => {
                    dbHandler.delete('top', top, () => { console.log("deleted"); });
                });
            }
        });
        
        $("#topicsModal").modal("hide");
    });
}

var addTopicOption = (option = -1) => {
    var blockerHTML = `<div class="col-md-12 topic-form" style="margin-top: 1em; text-align: center">
                                <input type="text" class="form-control align-middle topic-name" style="display: inline; width: 75%"></input>
                                <input type="color" class="form-control align-middle topic-color" style="display: inline; width: 15%"></input>
                                <span style="display: none" class="topUid"></span>
                                <button type="button" style="display: inline" class="btn btn-light topic-component remove-topic-option align-middle" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>`;
    var blockerel = $(blockerHTML);
    $('#addTopicButtonCont').after(blockerel);
    if (option != -1) {
        blockerel.find(".topic-color").val(getTopic(option).color);
        blockerel.find(".topic-name").val(getTopic(option).name);
        blockerel.find(".topUid").text(option.toString());
    }
    else {
        currentTopicUid++;
        blockerel.find(".topic-color").val("#007bff");
        blockerel.find(".topic-name").val(`Untitled Topic #${currentTopicUid}`);
        blockerel.find(".topUid").text(currentTopicUid.toString());
    }
    $('.remove-topic-option').unbind().click(function () {
        if (confirm("Are you sure you want to remove this topic?")) {
            $(this).parent().remove();
        }
    });
    
}

var getIconUid = (e) => {
    return e.parent().attr('id').substr(0, e.parent().attr('id').length - 8);
};

var populateDropdows = () => {
    taskArray.forEach((t) => {
        $(`#blockerDropdown`).append(`<option value="${t.uid}">${t.title}</option>`);
    });
}

var openTaskForm = (id) => {
    $(".blocker-component").remove();
    $(".topic-component").remove();
    if (id == -1) {
        $(".taskItem").val("");
        $("#taskEditMode").text("-1");
        $("#taskModalLabel").text("Add Task");
    }
    else if (id == -2) {

    }
    else {
        let t = getTask(id);
        $("#taskModalLabel").text("Add Task");
        $("#taskTitle").val(t.title);
        $("#taskDeadline").val(t.deadline);
        $("#taskDesc").val(t.content);
        t.topics.forEach((top) => {
            addTopic(top);
        });
        t.blockers.forEach((b) => {
            addBlocker(b);
        });
        $("#taskEditMode").text(id);
    }
    $('#taskModal').modal('show');
}

var genDropdownOptions = () => {
    blockerOptions = "";
    taskArray.filter((t) => { return !t.deleted;}).forEach((t) => {
        blockerOptions += `<option value="${t.uid}">${t.title}</option>`;
    });
    topicOptions = "";
    topicArray.forEach((t) => {
        topicOptions += `<option value="${t.uid}">${t.name}</option>`;
    });
}

$(document).ready(function () {
    if (window.localStorage.getItem("settings"))
        settings = JSON.parse(window.localStorage.getItem("settings"));
    $('#saveTask').click(function () {  
        var newTask = {}
        if ($("#taskEditMode").text() == "-1") {
            currentUid++;
            newTask = {
                blockers: [],
                completed: 0,
                content: $("#taskDesc").val() || "",
                created: Date.now(),
                deadline: $("#taskDeadline").val(),
                deleted: false,
                status: "backlog",
                tags: [],
                title: $("#taskTitle").val() || `Untitled Task #${currentUid}`,
                topics: [],
                uid: currentUid
            };
        }
        else {
            let t = getTask(parseInt($("#taskEditMode").text()));
            newTask = {
                blockers: [],
                completed: t.completed,
                content: $("#taskDesc").val() || "",
                created: t.created,
                deadline: $("#taskDeadline").val(),
                deleted: t.deleted,
                status: t.status,
                tags: t.tags,
                title: $("#taskTitle").val() || `Untitled Task #${currentUid}`,
                topics: [],
                uid: t.uid
            };
            taskArray.splice(getTaskIndex(parseInt($("#taskEditMode").text())), 1);
        }
        $(".blocker-select").each(function (i) {
            newTask.blockers.push($(this).val());
        });
        $(".topic-select").each(function (i) {
            newTask.topics.push($(this).val());
        });
        taskArray.push(newTask);
        addTaskToDb(newTask.uid);
        window.localStorage.setItem("currentUid", currentUid);
        genDropdownOptions();
        if ($("#taskEditMode").text() == "-1") {
            $(`#${newTask.status}Cards`).append(getTaskHtml(getTask(newTask.uid)));
            setOnclicks();
        }
        else
            updateTask(getTask(newTask.uid));
        $('#taskModal').modal('hide');
        
    });
    $('#addTaskButton').click(() => { openTaskForm(-1); })
    $('#openTopicButton').click(() => { openTopicForm(); })
    $('#addBlocker').click(() => { addBlocker(); })
    $('#addTopic').click(() => { addTopic(); })
    loadDb();
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

    $("#settingsModal").modal("hide");
});