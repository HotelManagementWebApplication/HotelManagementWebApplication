package com.hospitality.mis.dao.billing;



import com.hospitality.mis.entity.billing.ServiceUsage;

import com.hospitality.mis.entity.billing.ServiceUsageId;

import org.springframework.data.jpa.repository.JpaRepository;



/** Kho dòng sử dụng dịch vụ; thao tác mặc định của JpaRepository là đủ cho aggregate này. */
public interface ServiceLineRepository extends JpaRepository<ServiceUsage, ServiceUsageId> {

}
