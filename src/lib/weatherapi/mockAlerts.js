/**
 * Mock data cho weather alerts
 * Khớp với cấu trúc WeatherAPI Alerts Object
 * Sử dụng cho demo hoặc khi API không có alerts thực tế
 */

export const mockWeatherAlerts = [
    {
        headline:
            'Cảnh báo mưa lớn phát hành ngày 30 tháng 11 lúc 8:00 SA đến 20:00 PM bởi Đài KTTV',
        msgtype: 'Alert',
        severity: 'Moderate',
        urgency: 'Expected',
        areas: 'Ninh Bình; Hà Nam; Nam Định',
        category: 'Met',
        certainty: 'Likely',
        event: 'Cảnh báo mưa lớn',
        note: 'Cảnh báo cho khu vực Ninh Bình; Hà Nam; Nam Định. Phát hành bởi Đài Khí tượng Thủy văn Trung ương',
        effective: '2025-11-30T08:00:00+07:00',
        expires: '2025-11-30T20:00:00+07:00',
        desc:
            '...Cảnh báo mưa lớn tiếp tục cho các khu vực sau ở Bắc Trung Bộ...\n' +
            'Sông Hoàng Long tại Ninh Bình ảnh hưởng đến Ninh Bình, Hà Nam\n' +
            'và Nam Định.\n' +
            'Sông Đáy tại Phủ Lý ảnh hưởng đến\n' +
            'Hà Nam và Nam Định.\n' +
            'Sông Hồng tại Hà Nội ảnh hưởng đến Hà Nội.\n' +
            '...Cảnh báo mưa lớn hiện đang có hiệu lực đến chiều thứ Bảy...\n' +
            'Cảnh báo mưa lớn tiếp tục cho\n' +
            'Sông Hoàng Long tại Ninh Bình.\n' +
            '* Đến chiều thứ Bảy.\n' +
            '* Vào lúc 9:28 giờ tối thứ Ba mực nước đạt 115,6 feet.\n' +
            '* Mực nước ngập lụt là 115,0 feet.\n' +
            '* Ngập lụt nhỏ đang xảy ra và dự báo ngập lụt nhỏ.\n' +
            '* Hoạt động gần đây... Mực nước tối đa trong 24 giờ kết thúc\n' +
            'vào lúc 9:28 giờ tối thứ Ba là 118,2 feet.\n' +
            '* Dự báo... Sông sẽ dâng lên 115,7 feet ngay sau nửa đêm\n' +
            'đêm nay. Sau đó sẽ xuống dưới mức ngập lụt vào sáng mai xuống\n' +
            '114,2 feet và bắt đầu dâng trở lại vào tối mai. Sẽ dâng\n' +
            'lên 114,3 feet vào sáng sớm thứ Năm. Sau đó sẽ hạ xuống và\n' +
            'duy trì dưới mức ngập lụt.\n' +
            '* Ảnh hưởng... Ở mức 115,0 feet, Ngập lụt xảy ra tại các khu vực trũng thấp của\n' +
            'Khu vực Ninh Bình và tại Vườn Quốc gia Cúc Phương.\n' +
            '* Lịch sử ngập lụt... Đỉnh lũ này so sánh với đỉnh lũ trước đó là 116,3\n' +
            'feet vào ngày 03/12/2020.\n' +
            '&&',
        instruction:
            'Cảnh báo mưa lớn có nghĩa là ngập lụt đang xảy ra hoặc sắp xảy ra. Tất cả\n' +
            'người dân cần thực hiện các biện pháp phòng ngừa ngay lập tức.\n' +
            'Người lái xe không nên cố gắng lái xe vòng qua các chướng ngại vật hoặc lái\n' +
            'xe qua các khu vực bị ngập.\n' +
            'Cần thận trọng khi đi bộ gần bờ sông.\n' +
            'Thông tin bổ sung có tại www.nchmf.gov.vn.\n' +
            'Bản tin tiếp theo sẽ được phát hành vào sáng thứ Tư lúc 10:00 SA.',
    },
    {
        headline:
            'Cảnh báo gió mạnh phát hành ngày 30 tháng 11 lúc 2:00 CH đến 22:00 PM bởi Đài KTTV',
        msgtype: 'Alert',
        severity: 'Minor',
        urgency: 'Expected',
        areas: 'Ninh Bình',
        category: 'Met',
        certainty: 'Possible',
        event: 'Cảnh báo gió mạnh',
        note: 'Cảnh báo cho khu vực Ninh Bình. Phát hành bởi Đài Khí tượng Thủy văn',
        effective: '2025-11-30T14:00:00+07:00',
        expires: '2025-11-30T22:00:00+07:00',
        desc:
            '...Cảnh báo gió mạnh tiếp tục cho các sông sau ở Bắc\n' +
            'Trung Bộ...\n' +
            'Sông Hoàng Long tại Ninh Bình ảnh hưởng đến Ninh Bình.\n' +
            '...Cảnh báo gió mạnh hiện có hiệu lực đến đầu tối thứ Bảy...\n' +
            'Cảnh báo gió mạnh tiếp tục cho\n' +
            'Sông Hoàng Long tại Ninh Bình.\n' +
            '* Đến đầu tối thứ Sáu.\n' +
            '* Vào lúc 9:00 giờ tối thứ Ba mực nước là 16,5 feet.\n' +
            '* Mức gió mạnh là cấp 6-7.\n' +
            '* Gió mạnh nhỏ đang xảy ra và dự báo gió mạnh nhỏ.\n' +
            '* Hoạt động gần đây... Gió mạnh nhất trong 24 giờ kết thúc\n' +
            'vào lúc 9:00 giờ tối thứ Ba là cấp 7.\n' +
            '* Dự báo... Gió dự kiến giảm xuống dưới mức cảnh báo vào sáng sớm\n' +
            'thứ Sáu và tiếp tục giảm xuống cấp 4-5 vào tối Chủ nhật.\n' +
            '* Ảnh hưởng... Ở cấp 6-7, Gió bắt đầu ảnh hưởng tại\n' +
            'Khu vực Ninh Bình. Có thể làm gãy cành cây nhỏ.\n' +
            '* Ảnh hưởng... Ở cấp 8-9, Đường vào khu vực Tam Cốc\n' +
            'có thể bị ảnh hưởng. Cây cối lớn có thể bị gãy đổ.\n' +
            '* Lịch sử gió... Đợt gió này so sánh với đợt gió trước đó cấp 7\n' +
            'vào ngày 03/12/2020.\n' +
            '&&',
        instruction:
            'Cảnh báo gió mạnh có nghĩa là gió mạnh đang xảy ra hoặc sắp xảy ra. Tất cả\n' +
            'người dân cần thực hiện các biện pháp phòng ngừa ngay lập tức.\n' +
            'Người lái xe không nên cố gắng lái xe trong điều kiện gió mạnh.\n' +
            'Cần thận trọng khi đi gần các công trình cao tầng.\n' +
            'Thông tin bổ sung có tại www.nchmf.gov.vn.\n' +
            'Bản tin tiếp theo sẽ được phát hành vào sáng thứ Tư lúc 10:00 SA.',
    },
    {
        headline:
            'Cảnh báo nắng nóng phát hành ngày 01 tháng 12 lúc 11:00 SA đến 17:00 PM bởi Đài KTTV',
        msgtype: 'Alert',
        severity: 'Severe',
        urgency: 'Immediate',
        areas: 'Ninh Bình; Thanh Hóa; Nghệ An',
        category: 'Met',
        certainty: 'Likely',
        event: 'Cảnh báo nắng nóng',
        note: 'Cảnh báo cho khu vực Ninh Bình; Thanh Hóa; Nghệ An. Phát hành bởi Đài Khí tượng Thủy văn',
        effective: '2025-12-01T11:00:00+07:00',
        expires: '2025-12-01T17:00:00+07:00',
        desc:
            '...Cảnh báo nắng nóng tiếp tục cho các khu vực sau ở Bắc\n' +
            'Trung Bộ...\n' +
            'Khu vực Ninh Bình; Thanh Hóa; Nghệ An ảnh hưởng bởi nắng nóng gay gắt.\n' +
            '...Cảnh báo nắng nóng hiện có hiệu lực đến chiều thứ Hai...\n' +
            'Cảnh báo nắng nóng tiếp tục cho\n' +
            'Khu vực Ninh Bình; Thanh Hóa; Nghệ An.\n' +
            '* Đến chiều thứ Hai.\n' +
            '* Nhiệt độ cao nhất trong ngày phổ biến 37-39 độ C.\n' +
            '* Có nơi trên 40 độ C.\n' +
            '* Độ ẩm thấp nhất 40-50%.\n' +
            '* Hoạt động gần đây... Nhiệt độ cao nhất trong 24 giờ qua\n' +
            'đạt 38,5 độ C.\n' +
            '* Dự báo... Nhiệt độ sẽ tiếp tục tăng cao và duy trì ở mức\n' +
            '38-40 độ C trong ngày hôm nay. Dự kiến giảm nhẹ vào tối nay.\n' +
            '* Ảnh hưởng... Ở mức 37-39 độ C, Nguy cơ sốc nhiệt và đột quỵ do nắng nóng\n' +
            'tăng cao. Ảnh hưởng đến sức khỏe người dân.\n' +
            '* Ảnh hưởng... Ở mức trên 40 độ C, Nguy cơ cháy nổ và cháy rừng\n' +
            'cực kỳ cao. Ảnh hưởng nghiêm trọng đến sức khỏe và an toàn.\n' +
            '* Lịch sử nắng nóng... Đợt nắng nóng này so sánh với đợt nắng nóng trước đó\n' +
            'đạt 39,2 độ C vào ngày 15/07/2024.\n' +
            '&&',
        instruction:
            'Cảnh báo nắng nóng có nghĩa là nhiệt độ nguy hiểm đang xảy ra hoặc sắp xảy ra. Tất cả\n' +
            'người dân cần thực hiện các biện pháp phòng ngừa ngay lập tức.\n' +
            'Hạn chế hoạt động ngoài trời vào giữa trưa và đầu giờ chiều.\n' +
            'Uống đủ nước, không để cơ thể mất nước.\n' +
            'Đề phòng cháy nổ và cháy rừng.\n' +
            'Thông tin bổ sung có tại www.nchmf.gov.vn.\n' +
            'Bản tin tiếp theo sẽ được phát hành vào sáng thứ Ba lúc 10:00 SA.',
    },
    {
        headline:
            'Cảnh báo sương mù phát hành ngày 02 tháng 12 lúc 5:00 SA đến 9:00 SA bởi Đài KTTV',
        msgtype: 'Alert',
        severity: 'Minor',
        urgency: 'Expected',
        areas: 'Ninh Bình; Hòa Bình',
        category: 'Met',
        certainty: 'Likely',
        event: 'Cảnh báo sương mù',
        note: 'Cảnh báo cho khu vực Ninh Bình; Hòa Bình. Phát hành bởi Đài Khí tượng Thủy văn',
        effective: '2025-12-02T05:00:00+07:00',
        expires: '2025-12-02T09:00:00+07:00',
        desc:
            '...Cảnh báo sương mù tiếp tục cho các khu vực sau ở Miền\n' +
            'Núi Phía Bắc...\n' +
            'Khu vực Ninh Bình; Hòa Bình ảnh hưởng bởi sương mù dày đặc.\n' +
            '...Cảnh báo sương mù hiện có hiệu lực đến sáng thứ Hai...\n' +
            'Cảnh báo sương mù tiếp tục cho\n' +
            'Khu vực Ninh Bình; Hòa Bình.\n' +
            '* Đến sáng thứ Hai.\n' +
            '* Từ 5 giờ sáng đến 9 giờ sáng.\n' +
            '* Sương mù dày đặc làm tầm nhìn giảm xuống dưới 100m.\n' +
            '* Có nơi tầm nhìn dưới 50m.\n' +
            '* Hoạt động gần đây... Tầm nhìn thấp nhất trong sáng nay\n' +
            'đạt 45m.\n' +
            '* Dự báo... Sương mù dự kiến tiếp tục dày đặc trong sáng nay\n' +
            'và tan dần vào khoảng 9 giờ sáng.\n' +
            '* Ảnh hưởng... Ở tầm nhìn dưới 100m, Giao thông đường bộ bị ảnh hưởng\n' +
            'nghiêm trọng. Nguy cơ tai nạn giao thông tăng cao.\n' +
            '* Ảnh hưởng... Ở tầm nhìn dưới 50m, Giao thông đường bộ gần như\n' +
            'tê liệt. Rất nguy hiểm khi di chuyển.\n' +
            '* Lịch sử sương mù... Đợt sương mù này so sánh với đợt sương mù trước đó\n' +
            'có tầm nhìn 40m vào ngày 10/01/2024.\n' +
            '&&',
        instruction:
            'Cảnh báo sương mù có nghĩa là tầm nhìn bị hạn chế nghiêm trọng đang xảy ra hoặc sắp xảy ra. Tất cả\n' +
            'người dân cần thực hiện các biện pháp phòng ngừa ngay lập tức.\n' +
            'Người lái xe cần giảm tốc độ, bật đèn, giữ khoảng cách an toàn.\n' +
            'Hạn chế di chuyển nếu không cần thiết.\n' +
            'Đề phòng tai nạn giao thông.\n' +
            'Thông tin bổ sung có tại www.nchmf.gov.vn.\n' +
            'Bản tin tiếp theo sẽ được phát hành khi có thay đổi.',
    },
];

/**
 * Hàm lấy alerts ngẫu nhiên để demo
 */
export function getRandomAlerts(count = 2) {
    const shuffled = [...mockWeatherAlerts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

/**
 * Hàm lấy alerts theo severity
 */
export function getAlertsBySeverity(severity) {
    return mockWeatherAlerts.filter(alert => alert.severity === severity);
}

/**
 * Hàm kiểm tra có alerts đang active không
 */
export function hasActiveAlerts() {
    const now = new Date();
    return mockWeatherAlerts.some(alert => {
        const effective = new Date(alert.effective);
        const expires = new Date(alert.expires);
        return now >= effective && now <= expires;
    });
}

export default mockWeatherAlerts;
