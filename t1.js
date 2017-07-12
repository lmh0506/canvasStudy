onmessage = function(e){
    var num = 100;
    var arr = [];
    for(var i =0 ;i<num;i++)
    {
        arr.push(parseInt(Math.random()*100));
    }
    var newArr = [];
    for(var i = 0 ;i<arr.length;i++)
    {
        if(arr[i]%3==0)
            newArr.push(arr[i]);
    }
    postMessage(JSON.stringify(newArr));
    /*console.log(arr);
    var work = new Worker('t2.js');
    work.postMessage(JSON.stringify(arr));
    work.onmessage = function(e){
        postMessage(e.data);
    }*/
}