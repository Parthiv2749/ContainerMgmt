
import React from 'react';
import InvoiceTable from '../../TableDisplay/TableDiasplay';
// import VehicleCU from './VehicleCU.js'
import { useState,useEffect } from 'react';
import ContainerEntryForm from './ContainerForm.js';
import axios from 'axios';


async function getContainerData() {
  try {
    const response = await axios.get(`http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/containerDetaiils`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    let data = response.data;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    console.log("Fetched API data:", data);
    return data;
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return null;
  }
}

export default function ContainerEntry() {
    const [columns, setColumns] = useState([]);
    const [rows, setRows] = useState([]);
    
    async function fetchData() {
          const result = await getContainerData();
          if (!result || !result.column || !result.data) return;
          
          const productColumns = result.column.map(label => {
            const key = label
              .toLowerCase()
              .split(' ')
              .map((word, index) =>
                index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
              )
              .join('');

            const isHidden = key === "container_id"
            
            return { key, label, hidden: isHidden};
          });
          
          const dataRows = result.data.map(row => {
            const obj = {};
            productColumns.forEach((col, index) => {
              obj[col.key] = row[index];
            });
            return obj;
          });
          
          // console.log("Mapped columns:", productColumns);
          // console.log("Mapped rows:", dataRows);
          //
          setColumns(productColumns);
          setRows(dataRows);
    }

    useEffect(() => {
        fetchData();
    }, []);

    return(
        <div className='flex items-stretch p-4 overflow-hidden flex-col w-full max-h-screen'>


            <InvoiceTable 
                key={JSON.stringify(columns) + JSON.stringify(rows)}
                columns={columns} 
                rows={rows} 
                  addDataComponent={(props) => (
                    <ContainerEntryForm {...props} onSubmitSuccess={fetchData} 
    
                    />
                   
                  )}
                title="Add Container"
                onDataChange={fetchData}
            />

        </div>

    );

}