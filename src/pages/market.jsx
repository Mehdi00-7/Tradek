import React, { useState, useEffect,useRef} from 'react';
import CryptoChart from '../components/CryptoChart.jsx';
import axios from 'axios';
import '../styles/market.css';
import Head from 'next/head.js';
import Header from '@/components/navbar.jsx';
import { firestore,auth } from "../app/db.js";
import { collection, getDocs, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';

const Market = () => {
  const [cryptoData, selectCryptoData] = useState([]);
  const [selectedCoin, selectSelectedCoin] = useState(null);
  const [loading, selectLoading] = useState(true);
  const [buyPopupOpen, setBuyPopupOpen] = useState(false);
  const [sellPopupOpen, setSellPopupOpen] = useState(false);
  const [exchangePopupOpen, setExchangePopupOpen] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [crypto, setCrypto] = useState([]);
  const [exchangeCrypto, setExchangeCrypto] = useState('');
  const [isLoggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // New state for loading auth
  const docIdRef = useRef(null);
  const cryptoIdRef = useRef(null);

  useEffect(() => {
    const fetchCryptoData = async () => {
      try {
        const ids = 'bitcoin,ethereum,ripple,litecoin,dogecoin,solana,polkadot';
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
          params: {
            ids: ids,
            vs_currencies: 'usd',
          },
        });

        const data = Object.entries(response.data).map(([key, value]) => ({
          id: key,
          currency: 'USD',
          amount: value.usd,
        }));

        selectCryptoData(data);
      } catch (error) {
        console.error('Error fetching crypto:', error);
      } finally {
        selectLoading(false);
      }
    };

    fetchCryptoData();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setLoggedIn(true);
        setUser(currentUser);
      } else {
        setLoggedIn(false);
        setUser(null);
      }
      setLoadingAuth(false); 
    });

    // Cleanup the listener when the component unmounts
    console.log(isLoggedIn)
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user && user.uid) {
          let fetchedBalance = 0;
          let fetchedCrypto = {};

          // Fetch user balance
          const balanceQuery = query(collection(firestore, 'User Info'), where('email', '==', user.email));
          const balanceQuerySnapshot = await getDocs(balanceQuery);
          balanceQuerySnapshot.forEach((doc) => {
            fetchedBalance = doc.data().balance;
            docIdRef.current = doc.id;
          });

          // Fetch crypto holdings
          const holdingsQuery = query(collection(firestore, 'cryptoHoldings'), where('userID', '==',docIdRef.current));
          const holdingsQuerySnapshot = await getDocs(holdingsQuery);
          holdingsQuerySnapshot.forEach((doc) => {
            console.log(doc.id)
            fetchedCrypto = doc.data();
            cryptoIdRef.current=doc.id// Store crypto doc ID
          });

          // Update balance and crypto states
          setBalance(fetchedBalance);
          setCrypto(fetchedCrypto);

          // If you need to immediately use fetched balance and holdings:
          console.log("Fetched Balance:", fetchedBalance);
          console.log("Fetched Crypto Holdings:", fetchedCrypto);
        } else {
          setBalance(0);
          setCrypto({});
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchData();
  }, [user, loadingAuth]);
  

  const handleSelectCoin = (coin) => {
    selectSelectedCoin(coin);
  };

  const handleBuy = (coin) => {
    selectSelectedCoin(coin);
    setBuyPopupOpen(true);
  };

  const handleSell = (coin) => {
    selectSelectedCoin(coin);
    setSellPopupOpen(true);
  };

  const handleExchange = (coin) => {
    selectSelectedCoin(coin);
    setExchangePopupOpen(true);
  };

  const handleBuyPopupClose = () => {
    setBuyPopupOpen(false);
  };

  const handleSellPopupClose = () => {
    setSellPopupOpen(false);
  };

  const handleExchangePopupClose = () => {
    setExchangePopupOpen(false);
  };

  const handleTransaction = async () => {
    try {
      const selectedCryptoData = cryptoData.find(crypto => crypto.id === selectedCoin);
      if (!selectedCryptoData) {
        console.error('Selected coin data not found.');
        return;
      }

      if (selectedCoin && transactionAmount) {
        const coinPrice = selectedCryptoData.amount;
        const totalTransactionValue = transactionAmount / coinPrice;

        if (buyPopupOpen) {
          const requiredAmount = totalTransactionValue * coinPrice;
          if (requiredAmount > balance) {
            console.log(balance)
            console.error('Insufficient balance for this transaction.');
            alert('Insufficient balance for this transaction.')
            return;
          }
          const newBalance = balance - requiredAmount;
          console.log(newBalance)
          const userDocRef = doc(firestore, 'User Info', docIdRef.current);
          await updateDoc(userDocRef, { "balance": newBalance });

          const cryptoHoldingsRef = doc(firestore, 'cryptoHoldings', cryptoIdRef.current);
          const updatedHoldings = { ...crypto };
          if (updatedHoldings.holdings[selectedCoin]) {
            updatedHoldings.holdings[selectedCoin] += totalTransactionValue;
          } else {
            updatedHoldings.holdings[selectedCoin] = totalTransactionValue;
          }
          await updateDoc(cryptoHoldingsRef, updatedHoldings);
          await  addDoc(collection(firestore, 'transaction history'),{  
            type: 'Buy',
            monetaryAmount: transactionAmount,
            cryptoAmount: totalTransactionValue,
            pricePerCoin: coinPrice,
            date : new Date(),
            currency: selectedCoin,
            recipient: "",
            userID: docIdRef.current,
          });
          alert("You successfully purchased "+totalTransactionValue+" " +selectedCoin+" for "+transactionAmount+"$")
          setBalance(newBalance)
          console.log(updatedHoldings)
          setCrypto(updatedHoldings)
        } else if (sellPopupOpen) {
          const updatedHoldings = { ...crypto };
          console.log(updatedHoldings.holdings[selectedCoin])
          if (updatedHoldings.holdings[selectedCoin]) {
            if (updatedHoldings.holdings[selectedCoin] >= totalTransactionValue) {
              const newBalance = balance + (totalTransactionValue * coinPrice);
              const userDocRef = doc(firestore, 'User Info', docIdRef.current);
              await updateDoc(userDocRef,{"balance":newBalance})
              const cryptoHoldingsRef = doc(firestore, 'cryptoHoldings', cryptoIdRef.current);
              updatedHoldings.holdings[selectedCoin] -= totalTransactionValue;
              await updateDoc(cryptoHoldingsRef, updatedHoldings);
              await  addDoc(collection(firestore, 'transaction history'),{  
                type: 'Sell',
                monetaryAmount: transactionAmount,
                cryptoAmount: totalTransactionValue,
                pricePerCoin: coinPrice,
                date : new Date(),
                currency: selectedCoin,
                recipient: "",
                userID: docIdRef.current,
              });
              alert("You successfully sold "+totalTransactionValue+" "+selectedCoin+" for "+transactionAmount+"$")
              setBalance(newBalance)
              setCrypto(updatedHoldings)
            } else {
              console.error('Insufficient holdings for this transaction.');
              alert("Insufficient " +selectedCoin+" holdings for this transaction.");
              return;
            }
          } else {
            alert("No holdings found for : " +selectedCoin)
            return;
          }
        } else if (exchangePopupOpen) {
            if (exchangeCrypto === selectedCoin) {
              alert("You cannot exchange the same cryptocurrency ("+selectedCoin +" for "+selectedCoin+")");
              return;
            }
            const updatedHoldings = { ...crypto };
            const exchangeCryptoData = cryptoData.find(crypto => crypto.id === exchangeCrypto);
            if (!exchangeCryptoData) {
              console.error('Selected exchange coin data not found.');
              return;
            }
            if (updatedHoldings.holdings[selectedCoin]){
                if (updatedHoldings.holdings[selectedCoin]>= transactionAmount){
                    updatedHoldings.holdings[selectedCoin]-=transactionAmount
                    const equivalent= (transactionAmount*coinPrice)/ (exchangeCryptoData.amount)
                    console.log(equivalent)
                    //updatedHoldings.holdings[exchangeCrypto]+=equivalent
                    updatedHoldings.holdings[exchangeCrypto] = (updatedHoldings.holdings[exchangeCrypto] || 0) + equivalent;
                    const cryptoHoldingsRef = doc(firestore, 'cryptoHoldings', cryptoIdRef.current);
                    console.log("processing")
                    await updateDoc(cryptoHoldingsRef, updatedHoldings);
                    await  addDoc(collection(firestore, 'transaction history'),{  
                      type: 'Convert',
                      monetaryAmount: transactionAmount,
                      cryptoAmount: totalTransactionValue,
                      pricePerCoin: coinPrice,
                      date : new Date(),
                      currency: selectedCoin,
                      convertedTo: exchangeCrypto,
                      recipient: "",
                      userID: docIdRef.current,
                    });
                    console.log("updated")
                    alert("You successfully Exchanged "+transactionAmount+" "+selectedCoin+" for " +equivalent+" "+exchangeCrypto)
                    setCrypto(updatedHoldings)
                    console.log(updatedHoldings)
                }else{
                    console.log("not enough holdings")
                    alert("Not enough " +selectedCoin+" holdings")
                }
            }else{
                console.log("Holdings not found ")
                alert("No "+selectedCoin+ " holdings  in wallet")
            }
        }
        } else {
            console.error('Please select a coin and enter transaction amount.');
        }

      handleBuyPopupClose();
      handleSellPopupClose();
      handleExchangePopupClose();
      setTransactionAmount('');
    } catch (error) {
      console.error('Error executing transaction:', error);
    }
  };

  if (loading || loadingAuth) {
    return <div className="market-container">Loading market data...</div>;
  }

  return (
    <>
      <Header />
      <div className="market-container">
      
        <div className="market-list-container">
          
          
          <div className="crypto-list">
            {cryptoData.map((crypto, index) => (
              <div className="cryptoItem" key={index}>
                <div className="cryptoName">{crypto.id.toUpperCase()}/{crypto.currency}</div>
                <div className="cryptoPrice">${crypto.amount.toLocaleString()}</div>
                <button onClick={() => handleSelectCoin(crypto.id)}>View Chart</button>
                {isLoggedIn ?  (
                <>
                  <button onClick={() => handleBuy(crypto.id)}>Buy</button>
                  <button onClick={() => handleSell(crypto.id)}>Sell</button>
                  <button onClick={() => handleExchange(crypto.id)}>Exchange</button>
                </>
              ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="chart-container">
          {selectedCoin && <CryptoChart coinId={selectedCoin} />}
        </div>
      </div>
      {buyPopupOpen && (
        <div className="pop-container">
          <div className="pop">
            <div className="popup-inner">
              <h3>Buy {selectedCoin}</h3>
              <input type="number" placeholder="Amount in Dollars" value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} />
              <button onClick={handleTransaction}>Confirm Buy</button>
              <button onClick={handleBuyPopupClose}>Cancel</button>
            </div>
          </div>
          <div className="overlay"></div>
        </div>
      )}
      {sellPopupOpen && (
        <div className="pop-container">
          <div className="pop">
            <div className="popup-inner">
              <h3>Sell {selectedCoin}</h3>
              <input type="number" placeholder="Amount in Dollars" value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} />
              <button onClick={handleTransaction}>Confirm Sell</button>
              <button onClick={handleSellPopupClose}>Cancel</button>
            </div>
          </div>
          <div className="overlay"></div>
        </div>
      )}
      {exchangePopupOpen && (
        <div className="pop-container">
          <div className="pop">
            <div className="popup-inner">
              <h3>Exchange {selectedCoin}</h3>
              <select value={exchangeCrypto} onChange={(e) => setExchangeCrypto(e.target.value)}>
                <option value="">Exchange for</option>
                <option value="bitcoin">Bitcoin</option>
                <option value="ethereum">Ethereum</option>
                <option value="ripple">Ripple</option>
                <option value="litecoin">Litecoin</option>
                <option value="dogecoin">Dogecoin</option>
                <option value="solana">Solana</option>
                <option value="polkadot">Polkadot</option>
              </select>
              <input type="number" placeholder="Enter quantity to exchange" value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} />
              <button onClick={handleTransaction}>Confirm Exchange</button>
              <button onClick={handleExchangePopupClose}>Cancel</button>
            </div>
          </div>
          <div className="overlay"></div>
        </div>
      )}
    </>
  );
  
};

export default Market;
