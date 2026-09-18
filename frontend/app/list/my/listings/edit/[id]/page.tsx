import EditListing from '@/components/EditListing';
import React from 'react';
type Params={
    params:Promise<{id:string}>
}
const page =async ({params}:Params) => {
    const {id}=await params
  return (
    <div>
      <EditListing id={id}/>
    </div>
  );
}

export default page;
