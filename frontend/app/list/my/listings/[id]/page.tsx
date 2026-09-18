import MySpecificListing from '@/components/MySpecificListing';
import React from 'react';
type Params = {
  params: Promise<{ id: string }>;
};
const page = async({params}:Params) => {
 const {id}=await params
  return (
    <div>
      <MySpecificListing id={id}/>
    </div>
  );
}

export default page;
