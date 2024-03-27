var axios = require("axios");
exports.distance = async (lat1, lat2, lon1, lon2) => {
  console.log(lat1 + " " + lon1 + "  " + lat2 + " " + lon2);
  // The math module contains a function
  // named toRadians which converts from
  // degrees to radians.
  lon1 = (lon1 * Math.PI) / 180;
  lon2 = (lon2 * Math.PI) / 180;
  lat1 = (lat1 * Math.PI) / 180;
  lat2 = (lat2 * Math.PI) / 180;

  // Haversine formula
  let dlon = lon2 - lon1;
  let dlat = lat2 - lat1;
  let a =
    Math.pow(Math.sin(dlat / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon / 2), 2);

  let c = 2 * Math.asin(Math.sqrt(a));

  // Radius of earth in kilometers. Use 3956
  // for miles
  let r = 6371;

  // calculate the result
  return c * r;
};
exports.getLatLong = (keyword, limit) => {
  var config = {
    method: "get",
    url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${keyword}.json?types=place%2Cpostcode%2Caddress%2Ccountry%2Cregion%2Cdistrict%2Clocality%2Cneighborhood%2Cpoi&language=en&limit=1&access_token=${process.env.MAPBOX_TOKEN}`,
    headers: {},
  };
  console.log(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${keyword}.json?types=place%2Cpostcode%2Caddress%2Ccountry%2Cregion%2Cdistrict%2Clocality%2Cneighborhood%2Cpoi&language=en&limit=1&access_token=${process.env.MAPBOX_TOKEN}`
  );
  return new Promise((resolve, reject) => {
    axios(config)
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        reject(error);
        console.log(error);
      });
  });
};
exports.checkLatLong = (keyword) => {
  var config = {
    method: "get",
    url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${keyword}.json?country=us&types=region&worldview=us&access_token=${process.env.MAPBOX_TOKEN}`,
    headers: {},
  };
  return new Promise((resolve, reject) => {
    axios(config)
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        reject(error);
        console.log(error);
      });
  });
};
exports.getPlaces = (keyword, limit) => {
  var config = {
    method: "get",
    url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${keyword}.json?country=us&limit=${limit}&types=place%2Cpostcode%2Caddress%2Ccountry%2Cregion%2Cdistrict%2Clocality%2Cneighborhood%2Cpoi&language=en&access_token=${process.env.MAPBOX_TOKEN}`,
    headers: {},
  };
  console.log(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${keyword}.json?country=us&limit=${limit}&types=place%2Cpostcode%2Caddress%2Ccountry%2Cregion%2Cdistrict%2Clocality%2Cneighborhood%2Cpoi&language=en&access_token=${process.env.MAPBOX_TOKEN}`
  );
  return new Promise((resolve, reject) => {
    axios(config)
      .then(function (response) {
        resolve(response.data);
      })
      .catch(function (error) {
        reject(error);
        console.log(error);
      });
  });
};
exports.placeFilter = (data) => {
  if ("features" in data && data.features.length > 0) {
    let array = data.features.map((v) => ({
      title: v.text_en,
      placeName: v.place_name_en,
      lat:
        "geometry" in v && "coordinates" in v.geometry
          ? v.geometry.coordinates[1]
          : "",
      long:
        "geometry" in v && "coordinates" in v.geometry
          ? v.geometry.coordinates[0]
          : "",
    }));
    return array;
  }
  return [];
};
exports.formatAddress = (data) => {
  if (
    "features" in data &&
    data.features.length > 0 &&
    "text_en" in data.features[0] &&
    "place_name_en" in data.features[0] &&
    "context" in data.features[0]
  ) {
    let address = {
      placeName: data.features[0].text_en,
      placeAddress: data.features[0].place_name_en,
    };
    if (
      "geometry" in data.features[0] &&
      "coordinates" in data.features[0].geometry
    ) {
      address = Object.assign(address, {
        lat: data.features[0].geometry.coordinates[1],
        long: data.features[0].geometry.coordinates[0],
      });
    }

    if (data.features[0].context.length > 0) {
      let keys = [
        "landmark",
        "pincode",
        "locality",
        "city",
        "district",
        "region",
        "country",
      ];
      console.log(keys.length + "  " + data.features[0].context.length);
      const obj = {};
      let fields = data.features[0].context.map((e) => e.text_en);
      keys.forEach((element, index) => {
        obj[element] = fields[index];
      });
      address = Object.assign(address, obj);
    }
    return address;
  }
  return {};
};
