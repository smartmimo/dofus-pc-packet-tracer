const c = new WebSocket(`ws://${window.location.host}`);
c.onopen = () => {
    console.log('opened')
    c.send("cache")
}
c.onclose = () => {
    console.log("closed")
}

c.onmessage = async(e) => {
    const { message, data, type } = JSON.parse(e.data);
    if (message == "cache") {
        for (const msg of data) appendMessage(msg.message, msg.data, msg.type)
    } else appendMessage(message, data, type);
}

var jsons = []

function appendMessage(message, data, type) {
    $("#container").append(`
        <span class="${type} ${data || 'empty'}" onclick='showJson(this)'>${message}</span>
    `)

    jsons.push(data)
}

function showJson(el) {
    $(".packetTitle").html($(el).html())
    $('#jsonviewer').html(jsonViewer(jsons[$(el).index()], true));
    $('#jsonviewer').prepend(`<i class='fa fa-copy' onclick='copy(${$(el).index()})' style='position:absolute; top:0; right:0;'></i>`)
}

function copy(val) {
    if(!isNaN(parseInt(val))) val = JSON.stringify(jsons[val], null, 4)
    var $temp = $("<textarea>");
    $("body").append($temp);
    $temp.val(val).select();
    document.execCommand("copy");
    $temp.remove();
}