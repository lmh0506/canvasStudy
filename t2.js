onmessage = function(e){
    var arr = JSON.parse(e.data);
    var newArr = [];
    for(var i = 0 ;i<arr.length;i++)
    {
        if(arr[i]%3==0)
            newArr.push(arr[i]);
    }
    postMessage(JSON.stringify(newArr));
}