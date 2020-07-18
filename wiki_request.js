
var age_plot;
var occ_plot;

function RequestNameList() {
  var wiki_url = 'https://www.wikidata.org/w/api.php?action=parse&prop=wikitext&format=json&page=Wikidata:WikiProject_Names/lists/given_names_of_men';

  $.ajax({
    url: wiki_url,
    type: 'GET',
    dataType: "jsonp",
    error: function () {
      alert("name list error loading !");
      return false;
    }
  }).done(function (response) {
    // console.log("DONE !");
    // console.log(response);
    var str = JSON.stringify(response.parse.wikitext);
    var regex_pattern = /label ..\[\[:d:Q.*?\]\]/g;
    var matches = str.matchAll(regex_pattern);
    matches = Array.from(matches);
    for (var match_i = 0; match_i < matches.length; match_i++) {
      var qcode = matches[match_i].toString().match(/\w*[0-9]/g).toString();
      var name = matches[match_i].toString().match(/\|.*?\]/g).toString().slice(1, -1);//catch name & remove 1st & last charecters
      if (name.length <= 2 && name.includes('.')) continue;
      //  console.log("parsed: ",name,"    ",qcode);
      AddName(name, qcode);
      //break;
    }
  });
  age_plot = BuildAgePlot();
  occ_plot = BuildOccPlot();
}

function AddName(name, qcode) {
  var new_name = document.createElement("button");
  new_name.innerHTML += name;
  new_name.id = qcode;
  var body = document.getElementsByTagName("body")[0];
  body.appendChild(new_name);
  new_name.addEventListener("click", wikiRequest);
}

function wikiRequest(event) {
  //alert(event.target.id);
  var qcode = event.target.id;
  var wsparql_engine = 'https://query.wikidata.org/sparql?query=';
  var wquery_sparql = 'SELECT ?human ?age ?occupationLabel WITH{ ' +
    'SELECT DISTINCT ?human ?age ?occupation ?occupationLabel WHERE { ' +
    '?human wdt:P31 wd:Q5; ' +
    'wdt:P569 ?birth; ' +
    'wdt:P735 wd:' + qcode + '; ' +
    'wdt:P21 wd:Q6581097. hint:Prior hint:rangeSafe true. ' +
    'OPTIONAL{?human wdt:P570 ?ddeath.} ' +
    'bind( COALESCE(?ddeath, ?ddeath , NOW() ) as ?death). ' +
    'filter(?death > ?birth). ' +
    'bind((year(?death) - year(?birth)) as ?aage). ' +
    'filter (?age > 0 %26%26 ?age < 100). ' +
    '?human  wdt:P101 ?occupation. ' +
    '?occupation rdfs:label ?occupationLabel. ' +
    'FILTER (langMatches( lang(?occupationLabel), "EN" ) ). ' +
    'bind(round( ?aage/10 )*10 as ?age).} ' +
    '} AS %25res WHERE { ' +
    'INCLUDE %25res . ' +
    'SERVICE wikibase:label { bd:serviceParam wikibase:language "en".}} ORDER BY ?human &format=json';

  var wquery = wsparql_engine + wquery_sparql;

  //console.log(wquery);

  $.ajax({
    url: wquery,
    type: 'GET',
    dataType: "json",
    error: function () {
      alert("SPARQL query service problem !");
      return false;
    }
  }).done(function (response) {
    // console.log("DONE !");
    // console.log(response);
    age_plot.reset();
    age_plot.data.datasets[0].data = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    age_plot.data.datasets[0].label = document.getElementById(qcode).innerText;

    occ_plot.reset();
    occ_plot.data.datasets[0].data = [];
    occ_plot.data.labels = [];
    occ_plot.data.datasets[0].label = document.getElementById(qcode).innerText;

    ParseData(response);
  });

}

function ParseData(data) {
  var MappedOcc = new Map();

  data = data.results.bindings;
  var human_id = '-1';
  for (var i = 0; i < data.length; ++i) {
    var lang = (data[i].occupationLabel['xml:lang']).toString().toLowerCase();
    var occup = data[i].occupationLabel.value.toString().toLowerCase();
    var age = Number(data[i].age.value);
    var new_human_id = data[i].human.value.toString();
    if (human_id == '-1' || human_id != new_human_id) human_id = new_human_id;
    else continue;
    //TODO lang translate ?
    //console.log(lang," ",occup," ",age);
    age_plot.data.datasets[0].data[(age / 10) - 1] += 1;
    //break;
    //if(!lang.includes('en')) continue; //TODO free dictionary translate API ?
    if (MappedOcc.has(occup)) {
      var freq = Number(MappedOcc.get(occup)) + 1;
      MappedOcc.set(occup, freq);
    } else {
      MappedOcc.set(occup, 1);
    }
  }

  const MappedOccSort = new Map([...MappedOcc.entries()].sort((a, b) => b[1] - a[1]));
  var count = 1;
  for (const [key, value] of MappedOccSort.entries()) {
    if (count > 10) break;
    occ_plot.data.labels.push(key);
    occ_plot.data.datasets[0].data.push(value);
    //console.log(key,value);
    count++;
  }
  occ_plot.options.scale.ticks.max = occ_plot.data.datasets[0].data[0] + 1;
  occ_plot.options.scale.ticks.min = occ_plot.data.datasets[0].data[occ_plot.data.datasets[0].data.length - 1];
  if (occ_plot.data.datasets[0].data[0] < 6) {
    occ_plot.options.scale.ticks.stepSize = 0.5;
    occ_plot.options.scale.ticks.min = 0;
  }
  else occ_plot.options.scale.ticks.stepSize = 5;
  occ_plot.update();
  occ_plot.render();

  age_plot.update();
  age_plot.render();
}


function BuildAgePlot() {
  var age_plot = new Chart(document.getElementById("dage"), {
    type: 'bar',
    data: {
      labels: ['10', '20', '30', '40', '50', '60', '70', '80', '90'],
      datasets: [{
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        label: "Name",
        backgroundColor: "#0000FF",
        fill: true
      }]
    },
    options: {
      title: {
        display: true,
        text: 'Wiki age distribution for '
      },
      scales: {
        xAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Ages'
          }
        }]
      },
      responsive: true,
      maintainAspectRatio: true
    }
  });
  return age_plot;
}

function BuildOccPlot() {
  var occ_plot = new Chart(document.getElementById("docc"), {
    type: 'radar',
    data: {
      labels: [],
      datasets: [{
        data: [],
        label: "Name",
        backgroundColor: "#FFC0CB",
        fill: true
      }]
    },
    options: {
      title: {
        display: true,
        text: 'Wiki occupation plot for '
      },
      responsive: true,
      maintainAspectRatio: true,
      scale: {
        ticks: {
          beginAtZero: true,
          max: 100,
          min: 1,
          stepSize: 5,
          display: false
        }
      }
    }
  });
  return occ_plot;
}
