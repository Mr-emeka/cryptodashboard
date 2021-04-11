import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { baseURL, socketURL, formatData } from './helpers'
import Dashboard from './component/views/dashboard'

function App() {
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [pair, setPair] = useState<string>("");
  const [price, setPrice] = useState<string>("0.00");
  const [pastData, setPastData] = useState<any>({});

  const ws = useRef<any>(null);
  let first = useRef<boolean>(false);

  useEffect(() => {
    //connect to websocket API
    ws.current = new WebSocket(socketURL);
    //inside useEffect we need to make API with async function  
    const apiCall = async () => {
      let pairs: any[] = await fetch(baseURL + "/products")
        .then((res) => res.json())
        .then((data) => data);

      //coinbase returns over 120 currencies, this will filter to only USD based pairs
      let filtered = pairs.filter((pair) => pair.quote_currency === "USD")

      //sort filtered currency pairs alphabetically
      filtered = filtered.sort((a, b) => {
        return (a.base_currency < b.base_currency) ?
          -1 :
          (a.base_currency > b.base_currency) ?
            1 : 0;
      });

      setCurrencies(filtered);

      first.current = true;
    };

    //call async function
    apiCall()
  }, [])


  useEffect(() => {
    //prevents this hook from running on initial render
    if (!first.current) {
      return;
    }

    let msg = {
      type: "subscribe",
      product_ids: [pair],
      channels: ["ticker"]
    };

    let jsonMsg = JSON.stringify(msg);
    ws.current.send(jsonMsg);

    let historicalDataURL = `${baseURL}/products/${pair}/candles?granularity=86400`;

    const fetchHistoricalData = async () => {
      let dataArr: never[] = [];
      await fetch(historicalDataURL)
        .then((res) => res.json())
        .then((data) => (dataArr = data));

      //helper function to format data that will be implemented later
      let formattedData = formatData(dataArr);
      setPastData(formattedData);
    };
    //run async function to get historical data
    fetchHistoricalData();
    //need to update event listener for the websocket object so that it is listening for the newly updated currency pair
    ws.current.onmessage = (e: { data: string; }) => {
      let data = JSON.parse(e.data);
      if (data.type !== "ticker") {
        return;
      }
      //every time we receive an even from the websocket for our currency pair, update the price in state
      if (data.product_id === pair) {
        setPrice(data.price);
      }
    };
    //dependency array is passed pair state, will run on any pair state change
  }, [pair]);

  const handleSelect = (e: { target: { value: React.SetStateAction<string>; }; }) => {
    let unsubMsg = {
      type: "unsubscribe",
      product_ids: [pair],
      channels: ["ticker"]
    };
    let unsub = JSON.stringify(unsubMsg);

    ws.current.send(unsub);

    setPair(e.target.value);
  };

  return (
    <div className="container">
      {
        <select name="currency" value={pair} onChange={handleSelect}>
          {currencies.map((cur, idx) => {
            return (
              <option key={idx} value={cur.id}>
                {cur.display_name}
              </option>
            );
          })}
        </select>
      }
      <Dashboard price={price} data={pastData} />
    </div>
  );
}

export default App;
